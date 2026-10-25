import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {ToolRefusedError} from './toolResult';

export const toolDefinitions = [
  {type:'function',name:'list_files',description:'List workspace files. The .andrea directory lists only approved memory files; secret directories remain excluded.',parameters:{type:'object',properties:{directory:{type:'string',description:'Workspace-relative directory, default .'}},required:['directory'],additionalProperties:false}},
  {type:'function',name:'read_file',description:'Read a UTF-8 workspace text file, including .andrea/SEED.md, MEMORY.md, TASK.md and session records (read-only).',parameters:{type:'object',properties:{path:{type:'string',description:'Workspace-relative path'}},required:['path'],additionalProperties:false}},
  {type:'function',name:'write_file',description:'Create or overwrite a text file. Shows a before-and-after preview and requires explicit user approval.',parameters:{type:'object',properties:{path:{type:'string'},content:{type:'string'}},required:['path','content'],additionalProperties:false}},
  {type:'function',name:'run_command',description:'Start a shell command in the background after approval. Returns an ID to monitor with get_command_status. timeoutSeconds=0 leaves it running until stopped.',parameters:{type:'object',properties:{command:{type:'string',description:'Shell command'},timeoutSeconds:{type:'integer',minimum:0,maximum:300,description:'Maximum runtime in seconds; 0 disables the timeout.'}},required:['command'],additionalProperties:false}},
  {type:'function',name:'get_command_status',description:'Get output and status for a background shell command. Use waitMs to wait for more output or completion (maximum 20 seconds).',parameters:{type:'object',properties:{commandId:{type:'string'},waitMs:{type:'integer',minimum:0,maximum:20000}},required:['commandId'],additionalProperties:false}},
  {type:'function',name:'stop_command',description:'Stop a background shell command started by this agent using its command ID.',parameters:{type:'object',properties:{commandId:{type:'string'}},required:['commandId'],additionalProperties:false}},
  {type:'function',name:'get_diagnostics',description:'Get current editor errors and warnings in workspace.',parameters:{type:'object',properties:{},required:[],additionalProperties:false}}
] as const;

export type ApprovalPreview={path:string;original:string;proposed:string};
export type ApprovalRequester=(operation:'write_file'|'run_command',details:string,preview?:ApprovalPreview,signal?:AbortSignal)=>Promise<boolean>;
let requestApproval:ApprovalRequester=async()=>false;
export function setApprovalRequester(requester:ApprovalRequester){requestApproval=requester;}

type CommandStatus='running'|'completed'|'failed'|'stopped'|'timed_out';
type CommandRun={id:string;child:ChildProcess;output:string;status:CommandStatus;exitCode?:number|null;waiters:Set<()=>void>;timer?:NodeJS.Timeout;stopReason?:'stopped'|'timed_out'};
const commandRuns=new Map<string,CommandRun>();
function notify(run:CommandRun){for(const resolve of run.waiters)resolve();run.waiters.clear();}
function killTree(child:ChildProcess){
  if(!child.pid)return;
  if(process.platform==='win32'){
    const killer=spawn('taskkill',['/pid',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
    killer.on('error',()=>child.kill());
  }else{
    try{process.kill(-child.pid,'SIGTERM');}catch{child.kill();}
  }
}
function pruneCommandRuns(){
  const completed=[...commandRuns.values()].filter(run=>run.status!=='running');
  while(completed.length>25){const oldest=completed.shift();if(oldest)commandRuns.delete(oldest.id);}
}
function startCommand(command:string,timeoutMs:number):string{
  const cwd=root();
  const child=spawn(command,{cwd,shell:true,windowsHide:true,detached:process.platform!=='win32',env:{...process.env,OPENAI_API_KEY:undefined}});
  const run:CommandRun={id:randomUUID(),child,output:'',status:'running',waiters:new Set()};
  const finish=(status:CommandStatus,code?:number|null)=>{
    if(run.status!=='running')return;
    run.status=status;run.exitCode=code;clearTimeout(run.timer);notify(run);
  };
  if(timeoutMs>0)run.timer=setTimeout(()=>{if(run.status==='running'){run.stopReason='timed_out';killTree(child);finish('timed_out');}},timeoutMs);
  const append=(chunk:Buffer)=>{run.output=limit(run.output+chunk.toString());notify(run);};
  child.stdout?.on('data',append);child.stderr?.on('data',append);
  child.on('error',()=>finish('failed'));
  child.on('close',code=>finish(run.stopReason??(code===0?'completed':'failed'),code));
  commandRuns.set(run.id,run);pruneCommandRuns();
  return run.id;
}
async function commandStatus(commandId:string,waitMs:number):Promise<string>{
  const run=commandRuns.get(commandId);if(!run)throw Error('Unknown or expired command ID.');
  if(run.status==='running'&&waitMs>0){await new Promise<void>(resolve=>{
    const done=()=>{clearTimeout(timer);run.waiters.delete(done);resolve();};
    const timer=setTimeout(done,Math.min(Math.max(waitMs,0),20_000));run.waiters.add(done);
  });}
  const code=run.exitCode===undefined?'':` (exit code ${run.exitCode})`;
  return `Command ${run.id}: ${run.status}${code}\n${run.output||'(no output yet)'}`;
}
function stopCommand(commandId:string):string{
  const run=commandRuns.get(commandId);if(!run)throw Error('Unknown or expired command ID.');
  if(run.status==='running'){run.stopReason='stopped';killTree(run.child);run.status='stopped';clearTimeout(run.timer);notify(run);}
  return `Command ${run.id}: ${run.status}`;
}

const forbidden = new Set(['.andrea','.git','.env','.ssh','.aws','node_modules','dist','build','.next','coverage']);
// Only these project-memory files can be inspected through generic agent tools.
// All writes remain blocked; memory mutations must go through ProjectMemory.
const readableMemoryFiles = new Set(['SEED.md','MEMORY.md','TASK.md','summaries.jsonl','sessions.jsonl']);
function isReadableMemoryPath(rel:string):boolean {
  return rel.startsWith('.andrea/') && readableMemoryFiles.has(rel.slice('.andrea/'.length));
}
function root():string {const folders=vscode.workspace.workspaceFolders;if(!folders?.length)throw Error('Open a workspace folder first.');if(folders.length!==1)throw Error('MVP supports one workspace folder.');if(folders[0].uri.scheme!=='file')throw Error('Only local workspaces are supported.');return folders[0].uri.fsPath;}
function validateSegments(rel:string, mode:'read'|'write'|'list'='write') {
  if(mode==='read' && isReadableMemoryPath(rel))return;
  if(mode==='list' && rel==='.andrea')return;
  if(path.isAbsolute(rel) || rel.includes('\\') || rel.split('/').some(p=>p==='..'||forbidden.has(p)||p.startsWith('.env')))throw Error('Blocked path.');
}
async function checkedPath(rel:string, mode:'read'|'write'|'list'='write'):Promise<string>{
  validateSegments(rel,mode);const base=await fs.realpath(root());const target=path.resolve(base,rel);if(target!==base&&!target.startsWith(base+path.sep))throw Error('Outside workspace');
  let p=target;while(p!==base){try{const s=await fs.lstat(p);if(s.isSymbolicLink())throw Error('Symlink paths blocked');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}p=path.dirname(p);}return target;
}
function limit(s:string){return s.slice(0,vscode.workspace.getConfiguration('chatgptAgent').get<number>('maxOutputChars',12000));}
async function approvedWrite(rel:string,content:string,signal:AbortSignal):Promise<string>{
  if(content.length>1_000_000)throw Error('File too large (>1 MB).');
  const target=await checkedPath(rel);const old=await fs.readFile(target,'utf8').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return '';throw e;});
  const approved=await requestApproval('write_file',`${old?'Modify':'Create'} ${rel}`,{path:rel,original:old,proposed:content},signal);
  if(signal.aborted)throw Error('Cancelled before file change.');
  if(!approved)throw new ToolRefusedError('User rejected file change. File was not modified.');
  await checkedPath(rel);await fs.mkdir(path.dirname(target),{recursive:true});
  const uri=vscode.Uri.file(target);const edit=new vscode.WorkspaceEdit();
  const exists=await fs.stat(target).then(()=>true,()=>false);
  if(exists){const doc=await vscode.workspace.openTextDocument(uri);edit.replace(uri,new vscode.Range(doc.positionAt(0),doc.positionAt(doc.getText().length)),content);}
  else{edit.createFile(uri,{overwrite:false});edit.insert(uri,new vscode.Position(0,0),content);}
  if(signal.aborted)throw Error('Cancelled before applying file change.');
  if(!await vscode.workspace.applyEdit(edit))throw Error('VS Code failed to apply edit.');
  await (await vscode.workspace.openTextDocument(uri)).save();return `Applied ${rel}`;
}
export async function runTool(name:string,args:Record<string,unknown>,signal:AbortSignal):Promise<string>{
  if(signal.aborted)throw Error('Cancelled');
  switch(name){
    case 'list_files':{
      const rel=String(args.directory??'.');const dir=await checkedPath(rel,'list');const entries=await fs.readdir(dir,{withFileTypes:true});return limit(entries.filter(e=>!e.isSymbolicLink() && (rel==='.andrea'?e.isFile() && readableMemoryFiles.has(e.name):!forbidden.has(e.name)&&!e.name.startsWith('.env'))).map(e=>`${e.isDirectory()?'dir ':'file'} ${path.posix.join(rel,e.name)}`).join('\n'));}
    case 'read_file':{const target=await checkedPath(String(args.path),'read');const stat=await fs.stat(target);if(stat.size>200_000)throw Error('File too large (>200 KB)');const buf=await fs.readFile(target);if(buf.includes(0))throw Error('Binary file not supported');return limit(buf.toString('utf8'));}
    case 'write_file':return await approvedWrite(String(args.path),String(args.content),signal);
    case 'run_command':{
      if(signal.aborted)throw Error('Cancelled');const command=String(args.command);if(command.length>4000)throw Error('Command too long');
      const approved=await requestApproval('run_command',command,undefined,signal);if(signal.aborted)throw Error('Cancelled before command execution.');if(!approved)throw new ToolRefusedError('User rejected shell command. Command was not started.');
      const configuredTimeout=vscode.workspace.getConfiguration('chatgptAgent').get<number>('commandTimeoutSeconds',60);const timeoutSeconds=Number(args.timeoutSeconds??configuredTimeout);if(!Number.isInteger(timeoutSeconds)||timeoutSeconds<0||timeoutSeconds>300)throw Error('timeoutSeconds must be an integer from 0 to 300.');
      const id=startCommand(command,timeoutSeconds*1000);return `Started command in background. Command ID: ${id}. Use get_command_status with this ID to monitor output and completion${timeoutSeconds===0?' (no automatic timeout)':''}.`;}
    case 'get_command_status':return await commandStatus(String(args.commandId),Number(args.waitMs??0));
    case 'stop_command':return stopCommand(String(args.commandId));
    case 'get_diagnostics':{const base=root();const output:string[]=[];for(const [uri,diags] of vscode.languages.getDiagnostics()){if(uri.scheme!=='file'||!uri.fsPath.startsWith(base+path.sep))continue;for(const d of diags.slice(0,30))output.push(`${path.relative(base,uri.fsPath)}:${d.range.start.line+1}:${d.range.start.character+1} ${vscode.DiagnosticSeverity[d.severity]} ${d.message}`);}return limit(output.join('\n')||'No diagnostics available.');}
    default:throw Error('Unknown tool '+name);
  }
}
