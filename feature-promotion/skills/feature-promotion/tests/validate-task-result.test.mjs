import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const { validateTaskResult } = await import('../scripts/validate-task-result.mjs');
const sha = value => createHash('sha256').update(value).digest('hex');
const files = { 'drafts/A-1/changelog.md': Buffer.from('draft') };
const reader = store => async path => {
  if (!(path in store)) throw new Error('missing');
  return store[path];
};
const result = (overrides = {}) => ({
  taskId: 'draft.changelog.A-1',
  outcome: 'success',
  summary: 'Drafted the entry.',
  evidence: [{ kind: 'draft', path: 'drafts/A-1/changelog.md', sha256: sha('draft'), observation: 'Draft written from the fact sheet.' }],
  changedFiles: ['drafts/A-1/changelog.md'],
  checkpoint: null,
  unresolved: [],
  ...overrides,
});

test('a complete, current result for the dispatched task is valid', async () => {
  assert.deepEqual(await validateTaskResult(result(), 'draft.changelog.A-1', reader(files)), { valid: true, errors: [] });
});

test('a result for another task, an unknown outcome or extra fields is refused', async () => {
  const report = await validateTaskResult(result({ outcome: 'great', extra: 1 }), 'draft.changelog.B-2', reader(files));
  assert.equal(report.valid, false);
  assert.equal(report.errors.length, 3);
});

test('evidence that changed or is missing after the result was written is refused', async () => {
  const changed = await validateTaskResult(result(), 'draft.changelog.A-1', reader({ 'drafts/A-1/changelog.md': Buffer.from('edited') }));
  assert.match(changed.errors.join(' '), /changed since/);
  const missing = await validateTaskResult(result(), 'draft.changelog.A-1', reader({}));
  assert.match(missing.errors.join(' '), /missing/);
});

test('success cannot hide unresolved gaps or come without evidence', async () => {
  assert.equal((await validateTaskResult(result({ unresolved: ['No ticket says where to find it'] }), 'draft.changelog.A-1', reader(files))).valid, false);
  assert.equal((await validateTaskResult(result({ evidence: [], changedFiles: [] }), 'draft.changelog.A-1', reader(files))).valid, false);
  const blocked = result({ outcome: 'blocked', unresolved: ['Jira ticket is empty'] });
  assert.equal((await validateTaskResult(blocked, 'draft.changelog.A-1', reader(files))).valid, true);
});

test('a checkpoint is refused because promotion workers change no repository', async () => {
  const report = await validateTaskResult(result({ checkpoint: { reference: 'abc', scope: [] } }), 'draft.changelog.A-1', reader(files));
  assert.match(report.errors.join(' '), /checkpoint/);
});

test('command line reads only inside the run folder and sets the exit code', () => {
  const dir = mkdtempSync(join(tmpdir(), 'promotion-result-'));
  try {
    mkdirSync(join(dir, 'drafts/A-1'), { recursive: true });
    mkdirSync(join(dir, 'evidence/draft.changelog.A-1/1'), { recursive: true });
    writeFileSync(join(dir, 'drafts/A-1/changelog.md'), 'draft');
    writeFileSync(join(dir, 'evidence/draft.changelog.A-1/1/task-result.json'), JSON.stringify(result()));
    const script = fileURLToPath(new URL('../scripts/validate-task-result.mjs', import.meta.url));
    const run = (...args) => spawnSync('node', [script, dir, ...args], { encoding: 'utf8' });
    assert.equal(run('evidence/draft.changelog.A-1/1/task-result.json', '--task', 'draft.changelog.A-1').status, 0);
    assert.equal(run('evidence/draft.changelog.A-1/1/task-result.json', '--task', 'review.changelog.A-1').status, 1);
    assert.equal(run('../outside.json', '--task', 'draft.changelog.A-1').status, 1);
    writeFileSync(join(dir, 'evidence/draft.changelog.A-1/1/task-result.json'), JSON.stringify(result({ evidence: [{ kind: 'x', path: '../../etc/passwd', sha256: 'a'.repeat(64), observation: 'o' }] })));
    assert.match(JSON.parse(run('evidence/draft.changelog.A-1/1/task-result.json', '--task', 'draft.changelog.A-1').stdout).errors.join(' '), /leaves the run folder/);
    assert.equal(run().status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
