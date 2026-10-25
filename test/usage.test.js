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

test('officially listed models have verified standard token rates', () => {
  assert.deepEqual(Object.keys(RATES).sort(), ['gpt-6-astra', 'gpt-6-luna', 'gpt-6.1-sol']);
  assert.equal(RATES['gpt-6-luna'].input, 0.10);
  assert.equal(RATES['gpt-6-luna'].cached, 0.01);
  assert.equal(RATES['gpt-6-luna'].output, 0.50);
  assert.equal(RATES['gpt-6.1-sol'].input, 2.00);
  assert.equal(RATES['gpt-6.1-sol'].cached, 0.10);
  assert.equal(RATES['gpt-6.1-sol'].output, 10.00);
  assert.equal(RATES['gpt-6-astra'].input, 10.00);
  assert.equal(RATES['gpt-6-astra'].cached, 1.00);
  assert.equal(RATES['gpt-6-astra'].output, 50.00);
  for (const rate of Object.values(RATES)) {
    assert.equal(rate.asOf, '2026-10-25');
    assert.equal(rate.source, 'https://developers.openai.com/api/docs/pricing');
  }
});

test('unknown model costs remain unpriced, never reported as free', () => {
  const result = accumulate(emptyUsage(), 'unverified-model', {
    input_tokens: 10, output_tokens: 5
  });
  assert.equal(result.usd, 0);
  assert.equal(result.unpriced, 1);
});

test('pricing applies cached-input rate and excludes it from regular input', () => {
  const result = accumulate(emptyUsage(), 'gpt-6.1-sol', {
    input_tokens: 1_000_000,
    input_tokens_details: { cached_tokens: 250_000 },
    output_tokens: 100_000
  });
  assert.equal(result.usd, 2.525);
  assert.equal(result.unpriced, 0);
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
