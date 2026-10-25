import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {randomUUID} from 'node:crypto';
import {safeText} from './security';
import {ToolResult} from './toolResult';

export type TaskStatus='running'|'max_steps_reached'|'cancelled'|'interrupted'|'failed'|'completed';
export type Operation={key:string;name:string;callId:string;phase:'queued'|'executing'|'finished';result?:ToolResult};
export type PendingCall={callId:string;name:string;operationKey:string;result?:ToolResult};
export type AgentState={
  version:1; taskId:string; status:TaskStatus; objective:string; updatedAt:string;
  responseId?:string; chainValid:boolean; requestInFlight:boolean;
  stepsUsed:number; segmentSteps:number; maxSteps:number;
  pendingCalls:PendingCall[]; operations:Operation[]; recoveryUncertain:boolean;
};
export interface StateStore {save(state:AgentState):Promise<void>}
export function newState(objective:string,maxSteps:number):AgentState {
  return {version:1,taskId:randomUUID(),status:'running',objective:safeText(objective,1200),updatedAt:new Date().toISOString(),
    chainValid:false,requestInFlight:false,stepsUsed:0,segmentSteps:0,maxSteps,pendingCalls:[],operations:[],recoveryUncertain:false};
}
const resultValid=(r:unknown):r is ToolResult=>{
  if(!r||typeof r!=='object')return false;
  const v=r as ToolResult;
  return ['completed','failed','refused','cancelled','unknown'].includes(v.status)&&[true,false,'unknown'].includes(v.executed)&&
    (v.data===undefined||typeof v.data==='string')&&(v.error===undefined||typeof v.error==='string');
};
export function validState(value:unknown):value is AgentState {
  if(!value||typeof value!=='object')return false;
  const s=value as AgentState;
  if(s.version!==1||typeof s.taskId!=='string'||!s.taskId||typeof s.objective!=='string'||typeof s.updatedAt!=='string'||
    !['running','max_steps_reached','cancelled','interrupted','failed','completed'].includes(s.status)||
    typeof s.chainValid!=='boolean'||typeof s.requestInFlight!=='boolean'||typeof s.recoveryUncertain!=='boolean'||
    (s.responseId!==undefined&&(typeof s.responseId!=='string'||!s.responseId))||
    ![s.stepsUsed,s.segmentSteps,s.maxSteps].every(n=>Number.isSafeInteger(n)&&n>=0)||
    s.maxSteps<5||s.maxSteps>200||!Array.isArray(s.pendingCalls)||!Array.isArray(s.operations))return false;
  const keys=new Set<string>();
  for(const op of s.operations){
    if(!op||typeof op.key!=='string'||!op.key||keys.has(op.key)||typeof op.name!=='string'||typeof op.callId!=='string'||
      !['queued','executing','finished'].includes(op.phase)||(op.result!==undefined&&!resultValid(op.result))||
      (op.phase==='finished'&&!op.result))return false;
    keys.add(op.key);
  }
  const ids=new Set<string>();
  for(const call of s.pendingCalls){
    if(!call||typeof call.callId!=='string'||!call.callId||ids.has(call.callId)||typeof call.name!=='string'||
      !keys.has(call.operationKey)||(call.result!==undefined&&!resultValid(call.result)))return false;
    ids.add(call.callId);
  }
  return !s.chainValid||!!s.responseId;
}

/** No arguments, source files, prompts or API keys are stored. Outputs are bounded and redacted. */
export function cleanResult(result:ToolResult):ToolResult {
  return {status:result.status,executed:result.executed,
    ...(result.data!==undefined?{data:safeText(result.data,8000)}:{}),
    ...(result.error!==undefined?{error:safeText(result.error,2000)}:{})};
}
export class AgentStateStore implements StateStore {
  constructor(private readonly filename:string){}
  private async verify(){
    const dir=await fs.lstat(path.dirname(this.filename));
    if(!dir.isDirectory()||dir.isSymbolicLink())throw Error('Unsafe checkpoint directory.');
    try{const stat=await fs.lstat(this.filename);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Unsafe checkpoint file.');}
    catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  }
  async load():Promise<{state?:AgentState;warning?:string}> {
    await this.verify();
    let text:string;
    try{
      if((await fs.stat(this.filename)).size>16_000_000)return {warning:'Checkpoint too large; using memory-only recovery. Mutating tools disabled for this recovery.'};
      text=await fs.readFile(this.filename,'utf8');
    }catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {};throw e;}
    try{const state:unknown=JSON.parse(text);if(validState(state))return {state};}catch{/* Preserve the corrupt file until an explicit resume/new task. */}
    return {warning:'Checkpoint corrupt or incomplete; previous response ID will not be reused. Mutating tools disabled for memory-only recovery.'};
  }
  async save(state:AgentState):Promise<void> {
    if(!validState(state))throw Error('Refusing invalid checkpoint.');
    await this.verify();
    const text=JSON.stringify(state,null,2)+'\n';
    if(Buffer.byteLength(text)>16_000_000)throw Error('Checkpoint capacity exceeded; stopping before further operations.');
    const temporary=this.filename+'.'+randomUUID()+'.tmp';
    const handle=await fs.open(temporary,'wx',0o600);
    try{await handle.writeFile(text,'utf8');await handle.sync();}finally{await handle.close();}
    try{await fs.rename(temporary,this.filename);}catch(e){await fs.unlink(temporary).catch(()=>{});throw e;}
  }
}
