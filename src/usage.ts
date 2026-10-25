/** USD per million tokens: standard, short-context text rates.
 * Review https://developers.openai.com/api/docs/pricing before relying on estimates.
 */
export const RATES: Record<string, {input:number; cached:number; output:number}> = {
  'gpt-6-luna': {input:0.05,cached:0.005,output:0.25},
  'gpt-6.1-sol': {input:1,cached:0.05,output:5},
  'gpt-6-astra': {input:5,cached:0.5,output:25}
};
export type UsageTotals = {input:number;cached:number;output:number;reasoning:number;requests:number;usd:number;unpriced:number};
export const emptyUsage=():UsageTotals=>({input:0,cached:0,output:0,reasoning:0,requests:0,usd:0,unpriced:0});
export type ApiUsage={input_tokens?:number;output_tokens?:number;input_tokens_details?:{cached_tokens?:number};output_tokens_details?:{reasoning_tokens?:number}};
export function accumulate(total:UsageTotals,model:string,usage:ApiUsage|undefined):UsageTotals {
  if(!usage)return total;
  const input=Math.max(0,usage.input_tokens??0),output=Math.max(0,usage.output_tokens??0);
  const cached=Math.min(input,Math.max(0,usage.input_tokens_details?.cached_tokens??0));
  const reasoning=Math.min(output,Math.max(0,usage.output_tokens_details?.reasoning_tokens??0));
  const rate=RATES[model];
  const usd=rate?((input-cached)*rate.input+cached*rate.cached+output*rate.output)/1_000_000:0;
  return {input:total.input+input,cached:total.cached+cached,output:total.output+output,reasoning:total.reasoning+reasoning,requests:total.requests+1,usd:total.usd+usd,unpriced:total.unpriced+(rate?0:1)};
}
