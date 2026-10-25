export type ToolResult = {
  status:'completed'|'failed'|'refused'|'cancelled'|'unknown';
  executed:boolean|'unknown';
  data?:string;
  error?:string;
};
export class ToolRefusedError extends Error {}
export function cancelledResult():ToolResult {
  return {status:'cancelled',executed:false,error:'Operation not executed: task interrupted before execution.'};
}
