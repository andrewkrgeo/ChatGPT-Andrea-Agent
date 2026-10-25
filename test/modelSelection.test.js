const {test} = require('node:test');
const assert = require('node:assert/strict');
const {ModelSelection} = require('../dist/modelSelection');

test('missing credentials do not call the API; built-ins remain selectable', async () => {
  const state = new ModelSelection();
  const message = await state.retrieve(undefined, async () => { throw new Error('must not run'); });
  assert.match(message, /Set an API key/);
  assert.equal(state.loaded, false);
  assert.equal(state.canSelect('gpt-6.1-sol'), true);
  assert.equal(state.canSelect('custom'), false);
});

test('explicit retrieval enables custom selection and detects stale selections', async () => {
  const state = new ModelSelection();
  await state.retrieve('mock', async () => ['custom']);
  assert.equal(state.canSelect('custom'), true);
  assert.equal(state.isBuiltin('custom'), false);
  assert.equal(state.isStale('custom'), false);
  const message = await state.retrieve('mock', async () => []);
  assert.match(message, /No account models/);
  assert.equal(state.isStale('custom'), true);
  assert.equal(state.isStale('gpt-6.1-sol'), false);
  assert.equal(state.canSelect('custom'), false);
});

test('failed refresh keeps the previous catalog and sanitizes errors', async () => {
  const state = new ModelSelection();
  await state.retrieve('mock', async () => ['custom']);
  const message = await state.retrieve('mock', async () => { throw new Error('private request details'); });
  assert.doesNotMatch(message, /private request details/);
  assert.deepEqual(state.ids, ['custom']);
  assert.equal(state.busy, false);
});

test('credential changes discard in-flight results and concurrent retrieval is ignored', async () => {
  const state = new ModelSelection();
  let finish;
  const pending = state.retrieve('mock', () => new Promise(resolve => { finish = resolve; }));
  assert.match(await state.retrieve('mock', async () => ['other']), /already in progress/);
  state.invalidate();
  finish(['old-account-model']);
  assert.match(await pending, /Credentials changed/);
  assert.deepEqual(state.ids, []);
  assert.equal(state.loaded, false);
  assert.equal(state.busy, false);
});
