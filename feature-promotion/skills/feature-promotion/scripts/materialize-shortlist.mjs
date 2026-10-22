import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkDecisions } from './check-decisions.mjs';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const roles = ['headline', 'supporting', 'skip'];
const statuses = new Set(['pending', 'running', 'done', 'blocked', 'failed', 'skipped']);

/** Structural problems only; the shared workflow validator stays the full check after promotion. */
export function shapeErrors(workflow) {
  if (!object(workflow) || workflow.version !== 1 || !Array.isArray(workflow.phases) || !workflow.phases.length) {
    return ['Expected version 1 and a non-empty phases array.'];
  }
  const errors = [];
  const seen = new Map();
  workflow.phases.forEach((phase, phaseIndex) => {
    if (!object(phase) || !text(phase.id) || !text(phase.title) || !Array.isArray(phase.tasks) || !phase.tasks.length) {
      errors.push(`Phase ${phaseIndex} needs an id, a title and tasks.`);
      return;
    }
    for (const task of phase.tasks) {
      if (!object(task) || !text(task.id) || !text(task.title) || !statuses.has(task.status) || !Array.isArray(task.dependsOn)) {
        errors.push(`A task in ${phase.id} needs an id, a title, a known status and dependsOn.`);
        continue;
      }
      if (seen.has(task.id)) errors.push(`Duplicate task id: ${task.id}`);
      for (const dependency of task.dependsOn) {
        if (!seen.has(dependency) && !phase.tasks.some(other => other.id === dependency)) errors.push(`${task.id} depends on unknown or later task ${dependency}`);
      }
      seen.set(task.id, phaseIndex);
    }
  });
  return errors;
}

/** Entry ids to promote: one per headline story, plus one grouped entry when any supporting story is approved. */
export function entryIds(shortlist) {
  if (!object(shortlist) || shortlist.version !== 1 || !text(shortlist.runId) || !Array.isArray(shortlist.items)) {
    throw new Error('shortlist.json needs version 1, a runId and an items array.');
  }
  const seen = new Set();
  for (const item of shortlist.items) {
    if (!object(item) || !text(item.key) || !roles.includes(item.role) || !text(item.reason)) {
      throw new Error('Each shortlist item needs a key, a role of headline, supporting or skip, and a reason.');
    }
    if (seen.has(item.key)) throw new Error(`Duplicate shortlist item: ${item.key}`);
    seen.add(item.key);
  }
  const headlines = shortlist.items.filter(item => item.role === 'headline').map(item => item.key);
  const supporting = shortlist.items.some(item => item.role === 'supporting');
  const ids = supporting ? [...headlines, 'grouped'] : headlines;
  if (!ids.length) throw new Error('The approved shortlist promotes nothing; there is no work to add.');
  if (ids.includes('grouped') && headlines.includes('grouped')) throw new Error('A story key may not be called grouped.');
  return ids;
}

/**
 * Returns a new workflow with draft, review, demo and publish phases for every approved entry.
 * The input workflow is never changed. Each entry gets its own tasks so entries run in parallel.
 */
export function materializeWorkflow(workflow, shortlist) {
  const problems = shapeErrors(workflow);
  if (problems.length) throw new Error(`Current workflow is invalid: ${problems.join(' ')}`);
  const anchor = 'collect.recommend';
  const existing = workflow.phases.flatMap(phase => phase.tasks);
  const recommend = existing.find(task => task.id === anchor);
  if (!recommend || recommend.status !== 'done') throw new Error(`${anchor} must be done before the shortlist is turned into work.`);
  if (workflow.phases.some(phase => ['draft', 'review', 'demo', 'publish'].includes(phase.id))) {
    throw new Error('Draft, review, demo or publish phases already exist. Reconcile them instead of materializing again.');
  }
  const ids = entryIds(shortlist);
  const task = (id, title, agent, dependsOn) => ({ id, title, status: 'pending', dependsOn, agent });
  const next = structuredClone(workflow);
  next.phases.push(
    { id: 'draft', title: 'Draft', tasks: ids.map(id => task(`draft.changelog.${id}`, `Draft changelog entry ${id}`, 'writer', [anchor])) },
    { id: 'review', title: 'Review', tasks: ids.map(id => task(`review.changelog.${id}`, `Review changelog draft ${id}`, 'reviewer', [`draft.changelog.${id}`])) },
    {
      id: 'demo',
      title: 'Demo',
      tasks: ids.flatMap(id => [
        task(`demo.shotlist.${id}`, `Plan demo clip ${id}`, 'orchestrator', [`review.changelog.${id}`]),
        task(`demo.record.${id}`, `Record demo clip ${id}`, 'demo-recorder', [`demo.shotlist.${id}`]),
      ]),
    },
    {
      id: 'publish',
      title: 'Publish',
      tasks: ids.flatMap(id => [
        task(`publish.hidden.${id}`, `Create hidden changelog entry ${id}`, 'orchestrator', [`review.changelog.${id}`]),
        task(`publish.public.${id}`, `Make changelog entry ${id} public`, 'orchestrator', [`publish.hidden.${id}`]),
      ]),
    },
  );
  const after = shapeErrors(next);
  if (after.length) throw new Error(`Materialized workflow is invalid: ${after.join(' ')}`);
  return next;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [runDir, flag, out, ...extra] = process.argv.slice(2);
    if (!runDir || flag !== '--out' || !out || extra.length) throw new Error('Usage: node materialize-shortlist.mjs <run-dir> --out <new-workflow.json>');
    const base = resolve(runDir);
    const read = async name => JSON.parse(await readFile(resolve(base, name), 'utf8'));
    const [workflow, shortlist] = await Promise.all([read('workflow.json'), read('shortlist.json')]);
    const decisions = await read('decisions.json').catch(error => {
      if (error.code === 'ENOENT') return { version: 1, decisions: [] };
      throw error;
    });
    const scope = `workflow-plan:shortlist:${shortlist.runId}`;
    const gate = await checkDecisions(decisions, path => readFile(resolve(base, path)), [scope]);
    if (!gate.valid) throw new Error(`Shortlist is not approved: ${gate.errors.concat(gate.gates.filter(item => !item.ok).map(item => item.reason)).join(' ')}`);
    const decision = decisions.decisions.find(item => item.id === gate.gates[0].decisionId);
    if (!decision.inputs.some(input => input.path === 'shortlist.json')) throw new Error('The approval does not cover shortlist.json.');
    const next = materializeWorkflow(workflow, shortlist);
    await writeFile(resolve(out), JSON.stringify(next, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ valid: true, entries: entryIds(shortlist), tasks: next.phases.flatMap(phase => phase.tasks).length, out: resolve(out) }));
  } catch (error) {
    console.log(JSON.stringify({ valid: false, errors: [error.message] }));
    process.exitCode = 1;
  }
}
