const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchModelIds } = require('../dist/modelCatalog.js');

test('catalog returns sorted unique non-empty model IDs and ignores malformed entries', async () => {
  const ids = await fetchModelIds({ models: { list: async () => ({ data: [
    { id: 'zeta' }, { id: ' alpha ' }, { id: 'zeta' }, { id: '' }, { id: 42 }, null,
  ] }) } });
  assert.deepEqual(ids, ['alpha', 'zeta']);
});

test('catalog handles empty result', async () => {
  assert.deepEqual(await fetchModelIds({ models: { list: async () => ({ data: [] }) } }), []);
});

test('catalog errors are sanitized', async () => {
  await assert.rejects(
    fetchModelIds({ models: { list: async () => { throw new Error('secret-api-key'); } } }),
    error => error.message === 'Unable to retrieve the account model catalog. Check API access and try again.' && !error.message.includes('secret-api-key'),
  );
});

test('catalog rejects malformed response', async () => {
  await assert.rejects(fetchModelIds({ models: { list: async () => ({ data: null }) } }), /Unable to retrieve/);
});
