import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { checkDecisions, digest } = await import('../scripts/check-decisions.mjs');

const files = { 'drafts/a.md': Buffer.from('draft one') };
const reader = store => async path => {
  if (!(path in store)) throw new Error('missing');
  return store[path];
};
const decision = (overrides = {}) => ({
  id: 'd1',
  kind: 'verification',
  scopeId: 'draft:changelog:KAJOO-1',
  choice: 'verified',
  rationale: 'Read the text against the ticket.',
  userResponse: 'Looks good.',
  at: '2026-10-18T10:00:00Z',
  inputs: [{ path: 'drafts/a.md', sha256: digest(files['drafts/a.md']) }],
  ...overrides,
});
const doc = (...decisions) => ({ version: 1, decisions });
const need = 'verification:draft:changelog:KAJOO-1';

test('a current, user-traced approval satisfies its requirement', async () => {
  const result = await checkDecisions(doc(decision()), reader(files), [need]);
  assert.equal(result.valid, true);
  assert.equal(result.gates[0].ok, true);
  assert.equal(result.decisions[0].status, 'current');
});

test('editing a covered file makes the approval stale and blocks the gate', async () => {
  const edited = { 'drafts/a.md': Buffer.from('draft one, edited') };
  const result = await checkDecisions(doc(decision()), reader(edited), [need]);
  assert.equal(result.valid, false);
  assert.equal(result.decisions[0].status, 'stale');
  assert.match(result.gates[0].reason, /stale/);
});

test('a missing covered file blocks the gate', async () => {
  const result = await checkDecisions(doc(decision()), reader({}), [need]);
  assert.equal(result.decisions[0].status, 'missing');
  assert.equal(result.gates[0].ok, false);
});

test('a choice that is not an approval never approves', async () => {
  const result = await checkDecisions(doc(decision({ choice: 'needs-rework' })), reader(files), [need]);
  assert.equal(result.gates[0].ok, false);
  assert.match(result.gates[0].reason, /not an approval/);
});

test('an approval without the user response and time is not accepted', async () => {
  const { userResponse, ...withoutResponse } = decision();
  const result = await checkDecisions(doc(withoutResponse), reader(files), [need]);
  assert.equal(result.gates[0].ok, false);
  assert.match(result.gates[0].reason, /no recorded user response/);
  const badTime = await checkDecisions(doc(decision({ at: 'yesterday' })), reader(files), [need]);
  assert.equal(badTime.gates[0].ok, false);
});

test('the latest decision for a subject wins over an older approval', async () => {
  const older = decision({ id: 'old', at: '2026-10-18T09:00:00Z' });
  const newer = decision({ id: 'new', at: '2026-10-18T11:00:00Z', choice: 'pause' });
  const result = await checkDecisions(doc(older, newer), reader(files), [need]);
  assert.equal(result.gates[0].ok, false);
  assert.equal(result.decisions.find(entry => entry.id === 'old').effective, false);
  const reversed = await checkDecisions(doc(newer, older), reader(files), [need]);
  assert.equal(reversed.gates[0].ok, false);
});

test('a requirement with no decision, or a malformed requirement, fails', async () => {
  const none = await checkDecisions(doc(), reader(files), [need, 'broken']);
  assert.deepEqual(none.gates.map(gate => gate.ok), [false, false]);
});

test('each kind has its own approving choice', async () => {
  const mutation = decision({ id: 'm', kind: 'mutation', scopeId: 'publish:changelog:KAJOO-1', choice: 'approve-execution' });
  const plan = decision({ id: 'p', kind: 'workflow-plan', scopeId: 'shortlist:run-1', choice: 'approve' });
  const result = await checkDecisions(doc(mutation, plan), reader(files), ['mutation:publish:changelog:KAJOO-1', 'workflow-plan:shortlist:run-1']);
  assert.equal(result.valid, true);
  const wrong = await checkDecisions(doc({ ...mutation, choice: 'approve' }), reader(files), ['mutation:publish:changelog:KAJOO-1']);
  assert.equal(wrong.gates[0].ok, false);
});

test('malformed documents and decisions are reported, not thrown', async () => {
  assert.equal((await checkDecisions({}, reader(files))).valid, false);
  const bad = await checkDecisions(doc({ id: 'x', kind: 'nope' }, decision({ id: 'dup' }), decision({ id: 'dup' })), reader(files));
  assert.equal(bad.valid, false);
  assert.equal(bad.errors.length, 2);
});

test('command line reads the run folder, enforces the scope, and sets the exit code', () => {
  const dir = mkdtempSync(join(tmpdir(), 'promotion-decisions-'));
  try {
    writeFileSync(join(dir, 'a.md'), 'draft one');
    const entry = decision({ inputs: [{ path: 'a.md', sha256: digest(Buffer.from('draft one')) }] });
    writeFileSync(join(dir, 'decisions.json'), JSON.stringify(doc(entry)));
    const script = fileURLToPath(new URL('../scripts/check-decisions.mjs', import.meta.url));
    const run = (...args) => spawnSync('node', [script, dir, ...args], { encoding: 'utf8' });
    const ok = run('--require', need);
    assert.equal(ok.status, 0);
    assert.equal(JSON.parse(ok.stdout).valid, true);
    writeFileSync(join(dir, 'a.md'), 'draft one edited');
    assert.equal(run('--require', need).status, 1);
    const escape = decision({ inputs: [{ path: '../outside.md', sha256: 'a'.repeat(64) }] });
    writeFileSync(join(dir, 'decisions.json'), JSON.stringify(doc(escape)));
    assert.equal(JSON.parse(run('--require', need).stdout).decisions[0].status, 'missing');
    assert.equal(run('--require').status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
