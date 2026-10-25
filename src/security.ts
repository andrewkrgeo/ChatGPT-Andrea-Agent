import * as path from 'node:path';
import * as fs from 'node:fs/promises';

export const forbidden = new Set(['.andrea','.git','.env','.ssh','.aws','.azure','.gnupg','node_modules','dist','build','.next','coverage']);
export function sensitiveName(name:string):boolean {
  const s=name.toLowerCase();
  return forbidden.has(s)||s.startsWith('.env')||/\.(pem|key|p12|pfx|keystore)$/i.test(s)||/^(credentials|id_rsa|id_ed25519|secrets?)(\.|$)/i.test(s)||['.npmrc','.netrc','.pypirc'].includes(s);
}
export function validateRelative(rel:string):void {
  if(!rel||rel.includes('\0')||rel.includes('\\')||rel.includes(':')||path.posix.isAbsolute(rel)||path.win32.isAbsolute(rel)||rel.split('/').some(p=>p==='..'||sensitiveName(p)||/[. ]$/.test(p)&&p!=='.'))throw Error('Blocked path. Use a non-sensitive workspace-relative path without traversal.');
}
export async function checkedWorkspacePath(root:string,rel:string):Promise<string> {
  validateRelative(rel);
  const base=await fs.realpath(root),target=path.resolve(base,rel);
  if(target!==base&&!target.startsWith(base+path.sep))throw Error('Outside workspace.');
  let p=target;
  while(p!==base){try{const s=await fs.lstat(p);if(s.isSymbolicLink())throw Error('Symlink paths blocked.');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}p=path.dirname(p);}
  return target;
}
// const secretPattern=/(?:sk-[a-z0-9_-]{8,}|(?:api[_ -]?key|password|passwd|secret|access[_-]?token|authorization)\s*["']?\s*[:=]\s*\S+|bearer\s+\S+|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[A-Z0-9]{16}|gh[pousr]_[a-zA-Z0-9]{20,}|\beyJ[a-zA-Z0-9_-]{15,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)/i;
// export const hasSecret=(text:string)=>secretPattern.test(text);


const REDACTED = "[REDACTED]";

type Rule = Readonly<{ pattern: RegExp; replacement: string }>;

const rules: readonly Rule[] = [
  {
    // In caso di blocco incompleto, oscura tutto il resto del testo.
    pattern: /-----BEGIN ([A-Z ]*PRIVATE KEY)-----[\s\S]*?(?:-----END \1-----|$)/g,
    replacement: REDACTED
  },
  {
    pattern: /\bsk-[a-zA-Z0-9_-]{16,}(?![a-zA-Z0-9_-])/g,
    replacement: REDACTED
  },
  {
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
    replacement: REDACTED
  },
  {
    pattern: /\b(?:gh[pousr]_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,})(?![a-zA-Z0-9_])/g,
    replacement: REDACTED
  },
  {
    pattern: /\b(Bearer[ \t]+)[a-zA-Z0-9._~+\/-]+=*/gi,
    replacement: `$1${REDACTED}`
  },
  {
    // Conserva chiave, separatore e delimitatori del valore.
    // Le chiavi possono essere quotate; nei valori gestisce gli escape.
    pattern: /(?<![\w-])((?:(["'`])(?:api[_-]?key|password|passwd|secret|client[_-]?secret|access[_-]?token|refresh[_-]?token|authorization)\2|(?:api[_-]?key|password|passwd|secret|client[_-]?secret|access[_-]?token|refresh[_-]?token|authorization))(?=[ \t]*[:=])[ \t]*[:=][ \t]*)(["'`])(?:\\[^\r\n]|(?!\3)[^\\\r\n])*\3/gi,
    replacement: `$1$3${REDACTED}$3`
  }
];

export function redactSecrets(text: string): string {
  let result = text;
  for (const { pattern, replacement } of rules) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function safeText(text: string, max = 1200): string {
  const limit = Number.isFinite(max)
    ? Math.max(0, Math.floor(max))
    : 1200;

  return redactSecrets(text)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .slice(0, limit);
}
//?'[redacted: probable sensitive data]':text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').slice(0,max);
export function memoryCandidate(text:string):boolean {
  return !redactSecrets(text)&&!/(?:ignore (?:all |previous |prior )?instructions|system (?:prompt|message)|bypass .*approval|reveal .*secret|developer message|<\/?(?:system|developer)>)/i.test(text);
}
export function dangerousCommand(command:string):boolean {
  return /(?:\brm\b|\brmdir\b|\bdel\b|\bformat\b|\bmkfs\b|\bdiskpart\b|\bRemove-Item\b|\bgit\s+(?:reset|clean|push)\b|\b(?:curl|wget|Invoke-WebRequest)\b|\b(?:sudo|chmod|chown|reg)\b|\b(?:powershell|pwsh|cmd|bash|sh)\b|[>|])/i.test(command);
}
export function childEnvironment(env:NodeJS.ProcessEnv):NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([key])=>!/(?:key|token|secret|password|credential|authorization)/i.test(key)));
}
export function boundedAppend(current:string,chunk:string,max:number):string {return (current+chunk).slice(-max);}
