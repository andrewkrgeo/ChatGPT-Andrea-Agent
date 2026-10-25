/**
 * OpenAI API standard token pricing, USD per 1M tokens, checked 2026-10-25.
 * Official source: https://developers.openai.com/api/docs/pricing
 * Cached input uses the listed cached-input rate. Estimates exclude non-token
 * charges (for example tool calls) and may differ from the final invoice.
 */
export type ModelPricing = {
  input: number;
  cached: number;
  output: number;
  asOf: string;
  source: string;
};

const PRICING_SOURCE = 'https://developers.openai.com/api/docs/pricing';
const PRICING_AS_OF = '2026-10-25';

/** Rates are USD per 1M tokens for the standard processing tier. */
export const RATES: Readonly<Record<string, ModelPricing>> = Object.freeze({
  'gpt-6-luna': { input: 0.10, cached: 0.01, output: 0.50, asOf: PRICING_AS_OF, source: PRICING_SOURCE },
  'gpt-6.1-sol': { input: 2.00, cached: 0.10, output: 10.00, asOf: PRICING_AS_OF, source: PRICING_SOURCE },
  'gpt-6-astra': { input: 10.00, cached: 1.00, output: 50.00, asOf: PRICING_AS_OF, source: PRICING_SOURCE }
});
export type UsageTotals = {
  input: number; cached: number; output: number; reasoning: number;
  requests: number; usd: number; unpriced: number;
};
export const emptyUsage = (): UsageTotals => ({
  input: 0, cached: 0, output: 0, reasoning: 0, requests: 0, usd: 0, unpriced: 0
});
export type ApiUsage = {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { cached_tokens?: number };
  output_tokens_details?: { reasoning_tokens?: number };
};

/** Token categories are subtotals: cached input and reasoning output are not added twice. */
export function accumulate(total: UsageTotals, model: string, usage: ApiUsage | undefined): UsageTotals {
  if (!usage) return total;
  const input = Math.max(0, usage.input_tokens ?? 0);
  const output = Math.max(0, usage.output_tokens ?? 0);
  const cached = Math.min(input, Math.max(0, usage.input_tokens_details?.cached_tokens ?? 0));
  const reasoning = Math.min(output, Math.max(0, usage.output_tokens_details?.reasoning_tokens ?? 0));
  const rate = RATES[model];
  const usd = rate ? ((input - cached) * rate.input + cached * rate.cached + output * rate.output) / 1_000_000 : 0;
  return {
    input: total.input + input, cached: total.cached + cached,
    output: total.output + output, reasoning: total.reasoning + reasoning,
    requests: total.requests + 1, usd: total.usd + usd,
    unpriced: total.unpriced + (rate ? 0 : 1)
  };
}
