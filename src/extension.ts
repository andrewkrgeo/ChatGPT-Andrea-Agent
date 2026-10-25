import * as vscode from 'vscode';
import {randomUUID} from 'node:crypto';
import {CodingAgent} from './agent';
import {ProjectMemory} from './memory';
import {setApprovalRequester, type ApprovalPreview} from './workspaceTools';

class ChatViewProvider implements vscode.WebviewViewProvider {
  private view?:vscode.WebviewView;
  private agent:CodingAgent;
  private memory=new ProjectMemory();
  private approvals=new Map<string,(approved:boolean)=>void>();
  private previews=new Map<string,ApprovalPreview>();
  constructor(private context:vscode.ExtensionContext){
    this.agent=new CodingAgent(context.secrets,(kind,text)=>this.post({kind,text}),(conversation,session)=>this.post({kind:'usage',conversation,session}),this.memory);
    setApprovalRequester((operation,details,preview)=>this.requestApproval(operation,details,preview));
  }
  private requestApproval(operation:'write_file'|'run_command',details:string,preview?:ApprovalPreview):Promise<boolean>{
    if(!this.view)return Promise.resolve(false);
    const id=randomUUID();
    return new Promise(resolve=>{this.approvals.set(id,resolve);if(preview)this.previews.set(id,preview);this.post({kind:'approval',id,operation,details,preview});});
  }
  resolveWebviewView(view:vscode.WebviewView){
    this.view=view;view.webview.options={enableScripts:true};view.webview.html=this.html(view.webview);
    this.postSettings();this.agent.publishUsage();
    view.webview.onDidReceiveMessage(async(msg:unknown)=>{
      if(!msg||typeof msg!=='object')return;
      const m=msg as {type?:string;text?:string;value?:string;id?:string;approved?:boolean};
      if(m.type==='send'&&typeof m.text==='string'&&m.text.trim())await this.agent.send(m.text.trim());
      if(m.type==='stop')this.agent.cancel();
      if(m.type==='ready'){this.postSettings();this.agent.publishUsage();}
      if(m.type==='openDiff'&&typeof m.id==='string'){
        const preview=this.previews.get(m.id);if(preview){const original=await vscode.workspace.openTextDocument({language:'plaintext',content:preview.original});const proposed=await vscode.workspace.openTextDocument({language:'plaintext',content:preview.proposed});await vscode.commands.executeCommand('vscode.diff',original.uri,proposed.uri,'Agent proposal: '+preview.path,{preview:true});}
      }
      if(m.type==='approvalDecision'&&typeof m.id==='string'){
        const resolve=this.approvals.get(m.id);if(resolve){this.approvals.delete(m.id);this.previews.delete(m.id);resolve(m.approved===true);}
      }
      if(m.type==='reset')this.agent.reset();
      if(m.type==='key')await vscode.commands.executeCommand('chatgptAgent.setApiKey');
      if(m.type==='setModel'&&typeof m.value==='string'&&['gpt-6-luna','gpt-6.1-sol','gpt-6-astra'].includes(m.value)) {
        await vscode.workspace.getConfiguration('chatgptAgent').update('model',m.value,vscode.ConfigurationTarget.Global);
        this.agent.reset(); this.postSettings();
      }
      if(m.type==='setEffort'&&typeof m.value==='string'&&['low','medium','high','xhigh','max'].includes(m.value)) {
        await vscode.workspace.getConfiguration('chatgptAgent').update('reasoningEffort',m.value,vscode.ConfigurationTarget.Global);
        this.agent.reset(); this.postSettings();
      }
    });
  }
  async initializeMemory(){try{await this.memory.init();}catch(e){void vscode.window.showWarningMessage('Andrea memory initialization failed: '+String(e));}}
  refreshSettings(){this.postSettings();}
  private postSettings(){const c=vscode.workspace.getConfiguration('chatgptAgent');this.post({kind:'settings',model:c.get('model','gpt-6.1-sol'),effort:c.get('reasoningEffort','medium')});}
  reset(){this.agent.reset();this.post({kind:'reset',text:''});}
  private post(data:object){void this.view?.webview.postMessage(data);}
  private html(webview:vscode.Webview){
    const nonce=Array.from({length:24},()=>Math.floor(Math.random()*16).toString(16)).join('');
    return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';"><style nonce="${nonce}">
    *{box-sizing:border-box} body{margin:0;background:var(--vscode-sideBar-background);color:var(--vscode-foreground);font-family:var(--vscode-font-family);font-size:13px} .app{display:flex;flex-direction:column;height:100vh}.toolbar{display:flex;gap:6px;padding:10px;border-bottom:1px solid var(--vscode-panel-border)} button{border:0;border-radius:5px;padding:7px 10px;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);cursor:pointer}button:hover{filter:brightness(1.12)}button.primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground)} #messages{flex:1;overflow:auto;padding:12px;white-space:pre-wrap;overflow-wrap:anywhere}.message{padding:9px 11px;margin:0 0 10px;border-radius:8px;background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-panel-border)} .message.user{border-left:3px solid var(--vscode-focusBorder)}.message.tool{font-family:var(--vscode-editor-font-family);font-size:11px;opacity:.8}.message.error{border-left:3px solid var(--vscode-errorForeground)}.message.status{opacity:.7;background:transparent;border:0;padding:2px}.message.approval{border-left:3px solid var(--vscode-editorWarning-foreground)}.diffColumns{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}.diffColumns section{min-width:0}.diffColumns strong{font-size:11px}.diffColumns pre{max-height:220px;overflow:auto;margin:4px 0;padding:7px;background:var(--vscode-textCodeBlock-background);white-space:pre;tab-size:2;font:11px var(--vscode-editor-font-family)}.approvalActions{display:flex;gap:8px;margin-top:10px}.approvalActions button.approve{background:var(--vscode-testing-iconPassed);color:white}.approvalActions button.reject{background:var(--vscode-button-secondaryBackground)}.approvalActions button:disabled{opacity:.55;cursor:default} .name{font-weight:700;margin-bottom:5px}.composer{padding:10px;border-top:1px solid var(--vscode-panel-border)} textarea{display:block;width:100%;height:85px;resize:vertical;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);padding:9px;border-radius:6px;font:inherit}.actions{display:flex;justify-content:space-between;margin-top:8px;gap:6px}#hint{opacity:.65;font-size:11px;margin-top:6px}.settings{display:flex;flex-wrap:wrap;gap:8px;padding:9px 10px;border-bottom:1px solid var(--vscode-panel-border)}.field{display:flex;flex:1;min-width:115px;flex-direction:column;gap:4px}.field label{font-size:11px;opacity:.8}.field select{width:100%;color:var(--vscode-dropdown-foreground);background:var(--vscode-dropdown-background);border:1px solid var(--vscode-dropdown-border);border-radius:5px;padding:6px}
    .usage{border-bottom:1px solid var(--vscode-panel-border);padding:8px 10px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 10px;font-size:11px}.usage strong{font-size:12px}.usage .muted{opacity:.7}.usage .wide{grid-column:1/-1} .usage button{padding:2px 5px;font-size:10px} .usageTitle{display:flex;align-items:center;justify-content:space-between}
    </style></head><body><div class="app"><div class="toolbar"><button id="key">API Key</button><button id="reset">New chat</button><button id="stop">Stop</button></div><div class="settings"><div class="field"><label for="model">OpenAI model</label><select id="model"><option value="gpt-6-luna">GPT-6 Luna · economical</option><option value="gpt-6.1-sol">GPT-6.1 Sol · balanced</option><option value="gpt-6-astra">GPT-6 Astra · powerful</option></select></div><div class="field"><label for="effort">Reasoning intensity</label><select id="effort"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="xhigh">Extra High</option><option value="max">Maximum</option></select></div></div><div class="usage" aria-live="polite"><div class="usageTitle wide"><strong>API usage · current chat</strong><span class="muted">USD estimate</span></div><div>Input <strong id="in">0</strong></div><div>Output <strong id="out">0</strong></div><div>Cached input <strong id="cached">0</strong></div><div>Reasoning <strong id="reasoning">0</strong></div><div>Requests <strong id="requests">0</strong></div><div>Chat cost <strong id="cost">$0.000000</strong></div><div class="wide muted" id="sessionCost">Session total: $0.000000</div><div class="wide muted" id="usageNote">Estimated using standard short-context pricing; not a billing statement.</div></div><div id="messages" role="log" aria-live="polite"></div><div class="composer"><textarea id="prompt" placeholder="Ask agent to inspect, implement, test… (Ctrl+Enter to send)"></textarea><div class="actions"><span id="hint">File writes and commands need approval</span><button class="primary" id="send">Send ↵</button></div></div></div><script nonce="${nonce}">
    const vscode=acquireVsCodeApi();const messages=document.querySelector('#messages'),input=document.querySelector('#prompt');
    function add(kind,text){const box=document.createElement('div');box.className='message '+kind;const title=document.createElement('div');title.className='name';title.textContent=({user:'You',assistant:'Agent',tool:'Tool',error:'Error',status:'Status'})[kind]||kind;const body=document.createElement('div');body.textContent=text;box.append(title,body);messages.append(box);messages.scrollTop=messages.scrollHeight;return box;}
    function addApproval(d){const box=add('approval',d.details);box.querySelector('.name').textContent=d.operation==='run_command'?'Approval required · shell command':(d.preview?'File change · '+d.preview.path:'Approval required · file change');if(d.preview){const columns=document.createElement('div');columns.className='diffColumns';for(const [label,text] of [['Before',d.preview.original||'(new file)'],['After',d.preview.proposed]]){const section=document.createElement('section');const heading=document.createElement('strong');heading.textContent=label;const pre=document.createElement('pre');pre.textContent=text;section.append(heading,pre);columns.append(section);}box.append(columns);const open=document.createElement('button');open.textContent='Open diff editor';open.onclick=()=>vscode.postMessage({type:'openDiff',id:d.id});box.append(open);}const actions=document.createElement('div');actions.className='approvalActions';for(const [label,approved,cls] of [['Approve',true,'approve'],['Reject',false,'reject']]){const button=document.createElement('button');button.textContent=label;button.className=cls;button.onclick=()=>{actions.querySelectorAll('button').forEach(b=>b.disabled=true);vscode.postMessage({type:'approvalDecision',id:d.id,approved});};actions.append(button);}box.append(actions);messages.scrollTop=messages.scrollHeight;}
    function send(){const text=input.value.trim();if(!text)return;add('user',text);vscode.postMessage({type:'send',text});input.value='';}
    document.querySelector('#send').onclick=send;input.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();send();}});
    document.querySelector('#key').onclick=()=>vscode.postMessage({type:'key'});document.querySelector('#stop').onclick=()=>vscode.postMessage({type:'stop'});document.querySelector('#reset').onclick=()=>{messages.replaceChildren();vscode.postMessage({type:'reset'});};
    document.querySelector('#model').addEventListener('change',e=>vscode.postMessage({type:'setModel',value:e.target.value}));document.querySelector('#effort').addEventListener('change',e=>vscode.postMessage({type:'setEffort',value:e.target.value}));
    window.addEventListener('message',e=>{const d=e.data;if(d?.kind==='approval'){addApproval(d);return;}if(d?.kind==='usage'){const u=d.conversation||{},s=d.session||{};const fmt=n=>Number(n||0).toLocaleString();const money=n=>'$'+Number(n||0).toFixed(6);document.querySelector('#in').textContent=fmt(u.input);document.querySelector('#out').textContent=fmt(u.output);document.querySelector('#cached').textContent=fmt(u.cached);document.querySelector('#reasoning').textContent=fmt(u.reasoning);document.querySelector('#requests').textContent=fmt(u.requests);document.querySelector('#cost').textContent=money(u.usd);document.querySelector('#sessionCost').textContent='Extension session total: '+money(s.usd)+' · '+fmt(s.requests)+' requests';document.querySelector('#usageNote').textContent=u.unpriced?'Some requests have unknown prices; estimate incomplete.':'Estimated at standard short-context rates (USD); not an invoice.';return;}if(d?.kind==='settings'){document.querySelector('#model').value=d.model;document.querySelector('#effort').value=d.effort;return;}if(d?.kind==='reset'){messages.replaceChildren();return;}if(typeof d?.text==='string')add(d.kind,d.text);});
    vscode.postMessage({type:'ready'});add('status','Set your OpenAI API key, then describe a coding task.');
    </script></body></html>`;
  }
}

export function activate(context:vscode.ExtensionContext){
  const provider=new ChatViewProvider(context);void provider.initializeMemory();
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('chatgptAgent.chat',provider,{webviewOptions:{retainContextWhenHidden:true}}));
  context.subscriptions.push(vscode.commands.registerCommand('chatgptAgent.setApiKey',async()=>{
    const key=await vscode.window.showInputBox({title:'OpenAI API Key',prompt:'Stored in VS Code SecretStorage, not in the workspace',password:true,ignoreFocusOut:true,placeHolder:'sk-...'});
    if(key?.trim()){await context.secrets.store('openaiApiKey',key.trim());void vscode.window.showInformationMessage('API key saved securely.');}
  }));
  context.subscriptions.push(vscode.commands.registerCommand('chatgptAgent.openChat',async()=>{await vscode.commands.executeCommand('workbench.view.extension.chatgptAgent');}));
  context.subscriptions.push(vscode.commands.registerCommand('chatgptAgent.reset',()=>provider.reset()));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e=>{if(e.affectsConfiguration('chatgptAgent.model')||e.affectsConfiguration('chatgptAgent.reasoningEffort'))provider.refreshSettings();}));
}
export function deactivate(){}
