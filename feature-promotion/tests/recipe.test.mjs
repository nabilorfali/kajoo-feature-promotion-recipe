import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateWorkflow } from '../skills/workflow/scripts/validate.mjs';
import { materializeWorkflow } from '../skills/feature-promotion/scripts/materialize-shortlist.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(resolve(root, path), 'utf8');
const inlineList = (content, field) => [...content.match(new RegExp(`^${field}: (.+)$`, 'm'))[1].matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1]);
const walk = path => readdirSync(path, { withFileTypes: true }).flatMap(entry => {
  const child = resolve(path, entry.name);
  return entry.isDirectory() ? walk(child) : [child];
});
const agents = readdirSync(resolve(root, 'agents')).map(file => file.replace(/\.md$/, ''));
const skills = readdirSync(resolve(root, 'skills'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
const connectors = readdirSync(resolve(root, 'connectors')).map(file => read(`connectors/${file}`).match(/^name: (.+)$/m)[1].trim());

test('the recipe seeds no phases of its own', () => {
  assert.equal(existsSync(resolve(root, '.kajoo/workflow.json')), false);
});

test('the starting workflow is Collect only, and an approved shortlist adds the later phases in order', () => {
  const start = JSON.parse(read('skills/feature-promotion/assets/profiles/changelog/workflow.json'));
  assert.deepEqual(start.phases.map(phase => phase.id), ['collect']);
  assert.deepEqual(validateWorkflow(start).runnable, ['collect.stories']);
  start.phases[0].tasks.forEach(task => { task.status = 'done'; });
  const next = materializeWorkflow(start, { version: 1, runId: 'r', items: [{ key: 'A-1', role: 'headline', reason: 'x', title: 't', live: 'yes' }] });
  assert.equal(validateWorkflow(next).valid, true);
  const catalog = JSON.parse(read('skills/feature-promotion/assets/profiles/changelog/phase-catalog.json'));
  assert.deepEqual(next.phases.map(phase => phase.id), ['collect', ...catalog.phases.map(phase => phase.id)]);
});

test('every skill has matching metadata and only valid local links', () => {
  for (const name of skills) {
    assert.ok(read(`skills/${name}/SKILL.md`).startsWith(`---\nname: ${name}\n`), name);
    for (const file of walk(resolve(root, 'skills', name))) {
      if (!file.endsWith('.md')) continue;
      for (const [, link] of readFileSync(file, 'utf8').matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^(https?:|#|mailto:)/.test(link)) continue;
        assert.ok(existsSync(resolve(dirname(file), link.split('#')[0])), `${file}: ${link}`);
      }
    }
  }
});

test('every template named by the artifact skill and the phase catalog exists', () => {
  const catalog = JSON.parse(read('skills/feature-promotion/assets/profiles/changelog/phase-catalog.json'));
  const templates = catalog.phases.flatMap(phase => phase.tasks ? phase.tasks.map(task => task.template) : [phase.template]);
  for (const template of templates) assert.ok(existsSync(resolve(root, 'skills', template)), template);
  for (const file of readdirSync(resolve(root, 'skills/promotion-artifact/templates'))) {
    const content = read(`skills/promotion-artifact/templates/${file}`);
    for (const section of ['## Description', '## Inputs', '## Output', '## Acceptance criteria', '## Lifecycle and handoff', '## Technical report']) {
      assert.ok(content.includes(section), `${file}: ${section}`);
    }
    assert.ok(content.trimEnd().endsWith('keep chat summaries short.'), `${file} ends with the Technical report`);
  }
});

test('the run context names the Jira site, and every worker task that reads Jira passes it on', () => {
  const schema = JSON.parse(read('skills/feature-promotion/assets/contracts/context.schema.json'));
  const context = JSON.parse(read('skills/feature-promotion/assets/profiles/changelog/context.json'));
  assert.ok(schema.required.includes('jiraSite'));
  assert.match(context.jiraSite, new RegExp(schema.properties.jiraSite.pattern));
  for (const file of readdirSync(resolve(root, 'skills/promotion-artifact/templates'))) {
    const content = read(`skills/promotion-artifact/templates/${file}`);
    const owner = content.match(/Owner: ([a-z-]+)\./)[1];
    const readsJira = inlineList(read(`agents/${owner}.md`), 'tools').some(tool => tool.startsWith('jira/'));
    if (owner !== 'orchestrator' && readsJira) assert.ok(content.includes('`jiraSite`'), file);
  }
});

test('a paused publish step stays blocked, and is done only after the read-back', () => {
  for (const file of ['publish-hidden-task.md', 'publish-public-task.md']) {
    const lifecycle = read(`skills/promotion-artifact/templates/${file}`).split('## Lifecycle and handoff')[1].split('## Technical report')[0];
    assert.match(lifecycle, /Mark the task done only when the read-back/, file);
    assert.match(lifecycle, /record a `pause` decision and set this step to `blocked`/, file);
  }
});

test('every agent uses only skills and connectors the recipe ships, and loads task lifecycle guidance', () => {
  assert.deepEqual(agents.filter(name => /^isDefault: true$/m.test(read(`agents/${name}.md`))), ['orchestrator']);
  for (const name of agents) {
    const content = read(`agents/${name}.md`);
    const used = inlineList(content, 'skills');
    for (const skill of used) assert.ok(skills.includes(skill), `${name}: ${skill}`);
    assert.ok(used.includes('managing-kajoo-tasks') && used.includes('promotion-artifact') && used.includes('feature-promotion'), name);
    for (const tool of inlineList(content, 'tools')) {
      const [server, toolName, mode = 'auto'] = tool.split('/');
      assert.ok(connectors.includes(server) && toolName, `${name}: ${tool}`);
      assert.ok(['auto', 'approval-required', 'always-allow'].includes(mode), `${name}: ${tool}`);
    }
    assert.ok(inlineList(content, 'tools').includes('kajoo/get-task') && inlineList(content, 'tools').includes('kajoo/update-task'), name);
    for (const [, field, value] of content.matchAll(/^(name|description): (.+)$/gm)) assert.ok(!value.includes(': '), `${name} ${field} must not contain a colon and space`);
  }
});

test('only the orchestrator can call ReadMe, and every ReadMe call asks first', () => {
  for (const name of agents) {
    const readme = inlineList(read(`agents/${name}.md`), 'tools').filter(tool => tool.startsWith('readme/'));
    if (name === 'orchestrator') assert.deepEqual(readme, ['readme/execute-request/approval-required']);
    else assert.deepEqual(readme, [], name);
  }
});

test('workers are dispatched by task reference and write a validated task result', () => {
  assert.match(read('agents/orchestrator.md'), /Work on <kajoo-task taskId=/);
  for (const name of agents.filter(agent => agent !== 'orchestrator')) {
    const content = read(`agents/${name}.md`);
    assert.match(content, /get-task/);
    assert.match(content, /validate-task-result\.mjs/);
    assert.match(content, /Technical report/);
  }
});

test('connectors carry no secrets', () => {
  for (const file of readdirSync(resolve(root, 'connectors'))) {
    assert.doesNotMatch(read(`connectors/${file}`), /bearer\s+[A-Za-z0-9._~+\/-]{24,}|api[_-]?key\s*[:=]\s*['\"]?[A-Za-z0-9._-]{16,}|^\s*headers:/im, file);
  }
});
