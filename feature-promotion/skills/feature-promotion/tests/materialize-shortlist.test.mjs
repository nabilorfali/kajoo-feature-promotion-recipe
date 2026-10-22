import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const { entryIds, materializeWorkflow } = await import('../scripts/materialize-shortlist.mjs');
const { validateWorkflow } = await import('../../workflow/scripts/validate.mjs');

const collect = (status = 'done') => ({
  version: 1,
  phases: [{ id: 'collect', title: 'Collect', tasks: [
    { id: 'collect.stories', title: 'Read stories', status: 'done', dependsOn: [] },
    { id: 'collect.recommend', title: 'Recommend', status, dependsOn: ['collect.stories'] },
  ] }],
});
const item = (key, role) => ({ key, role, reason: 'because' });
const shortlist = (...items) => ({ version: 1, runId: 'run-1', items });

test('headlines get their own entry and supporting stories share one grouped entry', () => {
  assert.deepEqual(entryIds(shortlist(item('A-1', 'headline'), item('A-2', 'supporting'), item('A-3', 'supporting'), item('A-4', 'skip'))), ['A-1', 'grouped']);
  assert.deepEqual(entryIds(shortlist(item('A-1', 'headline'), item('A-2', 'headline'))), ['A-1', 'A-2']);
});

test('an empty or malformed shortlist is refused', () => {
  assert.throws(() => entryIds(shortlist(item('A-1', 'skip'))), /promotes nothing/);
  assert.throws(() => entryIds(shortlist({ key: 'A-1', role: 'maybe', reason: 'x' })), /role/);
  assert.throws(() => entryIds(shortlist(item('A-1', 'headline'), item('A-1', 'supporting'))), /Duplicate/);
  assert.throws(() => entryIds({}), /version 1/);
});

test('materializing adds draft, review, demo and publish phases in order and stays valid', () => {
  const base = collect();
  const next = materializeWorkflow(base, shortlist(item('A-1', 'headline'), item('A-2', 'supporting')));
  assert.deepEqual(next.phases.map(phase => phase.id), ['collect', 'draft', 'review', 'demo', 'publish']);
  assert.equal(validateWorkflow(next).valid, true);
  assert.deepEqual(validateWorkflow(next).runnable, ['draft.changelog.A-1', 'draft.changelog.grouped']);
  const demo = next.phases[3].tasks;
  assert.deepEqual(demo.find(task => task.id === 'demo.shotlist.A-1').dependsOn, ['review.changelog.A-1']);
  assert.deepEqual(demo.find(task => task.id === 'demo.record.A-1'), { id: 'demo.record.A-1', title: 'Record demo clip A-1', status: 'pending', dependsOn: ['demo.shotlist.A-1'], agent: 'demo-recorder' });
  const publish = next.phases[4].tasks;
  assert.deepEqual(publish.find(task => task.id === 'publish.public.A-1').dependsOn, ['publish.hidden.A-1']);
  assert.deepEqual(publish.find(task => task.id === 'publish.hidden.A-1').dependsOn, ['review.changelog.A-1']);
  assert.equal(base.phases.length, 1, 'input workflow is not changed');
});

test('it refuses to run before recommendation is done or twice', () => {
  assert.throws(() => materializeWorkflow(collect('pending'), shortlist(item('A-1', 'headline'))), /must be done/);
  const once = materializeWorkflow(collect(), shortlist(item('A-1', 'headline')));
  assert.throws(() => materializeWorkflow(once, shortlist(item('A-1', 'headline'))), /already exist/);
});

test('command line needs a current approval of the exact shortlist and never overwrites', () => {
  const dir = mkdtempSync(join(tmpdir(), 'promotion-materialize-'));
  try {
    const list = JSON.stringify(shortlist(item('A-1', 'headline')));
    writeFileSync(join(dir, 'shortlist.json'), list);
    writeFileSync(join(dir, 'workflow.json'), JSON.stringify(collect()));
    const approval = {
      id: 'g1', kind: 'workflow-plan', scopeId: 'shortlist:run-1', choice: 'approve', rationale: 'Nabil picked these.',
      userResponse: 'Approve the shortlist', at: '2026-10-18T10:00:00Z',
      inputs: [{ path: 'shortlist.json', sha256: createHash('sha256').update(list).digest('hex') }],
    };
    writeFileSync(join(dir, 'decisions.json'), JSON.stringify({ version: 1, decisions: [approval] }));
    const script = fileURLToPath(new URL('../scripts/materialize-shortlist.mjs', import.meta.url));
    const run = out => spawnSync('node', [script, dir, '--out', join(dir, out)], { encoding: 'utf8' });
    const ok = run('next.json');
    assert.equal(ok.status, 0, ok.stdout);
    assert.equal(validateWorkflow(JSON.parse(readFileSync(join(dir, 'next.json'), 'utf8'))).valid, true);
    assert.equal(run('next.json').status, 1, 'existing destination is refused');
    writeFileSync(join(dir, 'shortlist.json'), JSON.stringify(shortlist(item('A-1', 'headline'), item('A-9', 'headline'))));
    const stale = run('other.json');
    assert.equal(stale.status, 1);
    assert.match(JSON.parse(stale.stdout).errors[0], /not approved/);
    assert.equal(existsSync(join(dir, 'other.json')), false);
    assert.equal(spawnSync('node', [script, dir], { encoding: 'utf8' }).status, 1);
    rmSync(join(dir, 'decisions.json'));
    const none = run('third.json');
    assert.equal(none.status, 1);
    assert.match(JSON.parse(none.stdout).errors[0], /not approved.*No decision recorded/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
