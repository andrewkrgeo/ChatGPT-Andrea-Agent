const test = require('node:test');
const assert = require('node:assert/strict');
const { accumulate, emptyUsage, RATES } = require('../dist/usage.js');

test('empty usage totals start at zero', () => {
  assert.deepEqual(emptyUsage(), {
    input: 0, cached: 0, output: 0, reasoning: 0,
    requests: 0, usd: 0, unpriced: 0
  });
});

test('missing usage does not change totals', () => {
  const total = emptyUsage();
  assert.equal(accumulate(total, 'unknown-model', undefined), total);
});

test('token subtotals are bounded and not double-counted', () => {
  const result = accumulate(emptyUsage(), 'unknown-model', {
    input_tokens: 100,
    input_tokens_details: { cached_tokens: 120 },
    output_tokens: 40,
    output_tokens_details: { reasoning_tokens: 60 }
  });
  assert.deepEqual(result, {
    input: 100, cached: 100, output: 40, reasoning: 40,
    requests: 1, usd: 0, unpriced: 1
  });
});

test('unknown model costs remain unpriced, never reported as free', () => {
  assert.deepEqual(RATES, {});
  const result = accumulate(emptyUsage(), 'unverified-model', {
    input_tokens: 10, output_tokens: 5
  });
  assert.equal(result.usd, 0);
  assert.equal(result.unpriced, 1);
});

test('negative token counts are clamped to zero', () => {
  const result = accumulate(emptyUsage(), 'unknown-model', {
    input_tokens: -10, output_tokens: -5,
    input_tokens_details: { cached_tokens: -1 },
    output_tokens_details: { reasoning_tokens: -1 }
  });
  assert.deepEqual(result, {
    input: 0, cached: 0, output: 0, reasoning: 0,
    requests: 1, usd: 0, unpriced: 1
  });
});
