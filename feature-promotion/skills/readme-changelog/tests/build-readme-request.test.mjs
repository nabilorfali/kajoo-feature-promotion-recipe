import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { buildCreateRequest, parseDraft } = await import('../scripts/build-readme-request.mjs');

const draft = (overrides = {}, body = 'Auto mode now shows the model that answered.\n\n- See the model name next to each response.') => {
  const header = { title: 'See which model Auto picked', type: 'improved', slug: 'see-which-model-auto-picked', stories: '[KAJOO-5292]', ...overrides };
  return `---\n${Object.entries(header).map(([key, value]) => `${key}: ${value}`).join('\n')}\n---\n${body}\n`;
};

test('a valid draft becomes a hidden, non-indexed create request with the body only', () => {
  const request = buildCreateRequest(draft());
  assert.deepEqual(request, {
    title: 'See which model Auto picked',
    slug: 'see-which-model-auto-picked',
    type: 'improved',
    content: { body: 'Auto mode now shows the model that answered.\n\n- See the model name next to each response.' },
    privacy: { view: 'anyone_with_link' },
    allow_crawlers: 'disabled',
  });
});

test('ticket keys stay in the header and never reach the public text', () => {
  assert.equal(JSON.stringify(buildCreateRequest(draft())).includes('KAJOO-5292'), false);
  assert.throws(() => buildCreateRequest(draft({}, 'Fixed in KAJOO-5292.')), /ticket keys/);
  assert.throws(() => buildCreateRequest(draft({ title: 'Fix KAJOO-5292' })), /ticket keys/);
  assert.throws(() => buildCreateRequest(draft({ slug: 'kajoo-5292-fix' })), /ticket key/);
  assert.equal(buildCreateRequest(draft({ slug: 'gpt-5-model-picker' })).slug, 'gpt-5-model-picker');
});

test('bad header fields are all reported together', () => {
  assert.throws(() => buildCreateRequest(draft({ title: 'Ends with a period.', type: 'removed', slug: 'Bad Slug', stories: 'KAJOO-1' })), error => {
    for (const part of ['punctuation', 'type must be', 'slug must be', 'stories must']) assert.match(error.message, new RegExp(part));
    return true;
  });
});

test('placeholders, future promises and empty or oversized bodies are refused', () => {
  assert.throws(() => buildCreateRequest(draft({}, 'Coming soon: a faster picker.')), /shipped work/);
  assert.throws(() => buildCreateRequest(draft({}, 'Works with TBD models.')), /placeholders/);
  assert.throws(() => buildCreateRequest(draft({}, '[confirm where to find it]')), /placeholders/);
  assert.throws(() => buildCreateRequest(draft({}, '')), /body must be/);
  assert.throws(() => buildCreateRequest(draft({}, 'x'.repeat(4001))), /body must be/);
});

test('a draft without a header is refused', () => {
  assert.throws(() => parseDraft('just text'), /header/);
  assert.throws(() => parseDraft('---\nnot a header line\n---\nbody'), /Unreadable/);
});

test('command line writes a new file only and reports problems with exit 1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'promotion-readme-'));
  try {
    const script = fileURLToPath(new URL('../scripts/build-readme-request.mjs', import.meta.url));
    writeFileSync(join(dir, 'changelog.md'), draft());
    const run = out => spawnSync('node', [script, join(dir, 'changelog.md'), '--out', join(dir, out)], { encoding: 'utf8' });
    const ok = run('create.json');
    assert.equal(ok.status, 0, ok.stdout);
    assert.equal(JSON.parse(readFileSync(join(dir, 'create.json'), 'utf8')).privacy.view, 'anyone_with_link');
    assert.equal(run('create.json').status, 1, 'existing destination is refused');
    writeFileSync(join(dir, 'changelog.md'), draft({ type: 'nope' }));
    const bad = run('other.json');
    assert.equal(bad.status, 1);
    assert.equal(existsSync(join(dir, 'other.json')), false);
    assert.equal(spawnSync('node', [script], { encoding: 'utf8' }).status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
