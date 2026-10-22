import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const timestamp = value => text(value) && !Number.isNaN(Date.parse(value));

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');

const kinds = ['scope', 'mapping', 'overwrite', 'mutation', 'verification', 'phase-continuation', 'workflow-plan'];

/** Choice that counts as a yes for each decision kind. Anything else never approves. */
export const approvingChoices = {
  scope: ['approve'],
  mapping: ['approve'],
  overwrite: ['approve'],
  'workflow-plan': ['approve'],
  verification: ['verified'],
  mutation: ['approve-execution'],
  'phase-continuation': ['continue'],
};

const keyOf = decision => [decision.kind, decision.scopeId, decision.taskId ?? '', decision.entityId ?? ''].join('|');

function shapeError(decision) {
  if (!object(decision)) return 'not an object';
  for (const field of ['id', 'scopeId', 'choice', 'rationale']) {
    if (!text(decision[field])) return `${field} is required`;
  }
  if (!kinds.includes(decision.kind)) return `kind must be one of ${kinds.join(', ')}`;
  for (const field of ['taskId', 'entityId', 'userResponse', 'at']) {
    if (decision[field] !== undefined && !text(decision[field])) return `${field} must be a non-empty string when present`;
  }
  if (!Array.isArray(decision.inputs) || decision.inputs.length === 0) return 'inputs must list at least one file';
  for (const input of decision.inputs) {
    if (!object(input) || !text(input.path) || !/^[a-f0-9]{64}$/.test(input.sha256 ?? '')) return 'each input needs a path and a 64 character sha256';
  }
  return null;
}

/**
 * Pure check of a decisions document. `readBytes(path)` returns the current bytes of an input file
 * or throws when it is missing. Never writes. An approval counts only when every file it covered
 * still hashes to the recorded value and the user's own response and time are recorded.
 * Requirements are "kind:scopeId" strings; each needs a current, approving, effective decision.
 */
export async function checkDecisions(document, readBytes, requirements = []) {
  const errors = [];
  if (!object(document) || document.version !== 1 || !Array.isArray(document.decisions)) {
    return { valid: false, errors: ['Expected { version: 1, decisions: [...] }.'], decisions: [], gates: [] };
  }
  const ids = new Set();
  const decisions = [];
  for (const [index, decision] of document.decisions.entries()) {
    const problem = shapeError(decision);
    if (problem) {
      errors.push(`Decision ${index}: ${problem}.`);
      continue;
    }
    if (ids.has(decision.id)) {
      errors.push(`Duplicate decision id: ${decision.id}`);
      continue;
    }
    ids.add(decision.id);
    let status = 'current';
    for (const input of decision.inputs) {
      try {
        if (digest(await readBytes(input.path)) !== input.sha256) status = status === 'missing' ? status : 'stale';
      } catch {
        status = 'missing';
      }
    }
    const traced = text(decision.userResponse) && timestamp(decision.at);
    decisions.push({
      id: decision.id,
      kind: decision.kind,
      scopeId: decision.scopeId,
      taskId: decision.taskId,
      choice: decision.choice,
      at: decision.at,
      order: index,
      status,
      traced,
      approving: status === 'current' && traced && approvingChoices[decision.kind].includes(decision.choice),
      effective: false,
    });
  }
  // Latest decision for the same subject wins; an older one is history, not a second approval.
  const latest = new Map();
  for (const entry of decisions) {
    const key = keyOf(entry);
    const best = latest.get(key);
    const newer = !best || (Date.parse(entry.at) || 0) > (Date.parse(best.at) || 0)
      || ((Date.parse(entry.at) || 0) === (Date.parse(best.at) || 0) && entry.order > best.order);
    if (newer) latest.set(key, entry);
  }
  for (const entry of latest.values()) entry.effective = true;

  const gates = requirements.map(requirement => {
    const split = requirement.indexOf(':');
    const kind = requirement.slice(0, split);
    const scopeId = requirement.slice(split + 1);
    const matches = decisions.filter(entry => entry.effective && entry.kind === kind && entry.scopeId === scopeId);
    if (split < 1 || !scopeId) return { requirement, ok: false, reason: 'Requirement must look like kind:scopeId.' };
    if (!matches.length) return { requirement, ok: false, reason: 'No decision recorded.' };
    const failing = matches.find(entry => !entry.approving);
    if (failing) {
      const reason = failing.status !== 'current'
        ? `Decision ${failing.id} is ${failing.status}: a file it covered changed or is missing. Ask again.`
        : !failing.traced
          ? `Decision ${failing.id} has no recorded user response and time.`
          : `Decision ${failing.id} chose "${failing.choice}", which is not an approval.`;
      return { requirement, ok: false, reason };
    }
    return { requirement, ok: true, decisionId: matches[0].id };
  });
  const valid = errors.length === 0 && gates.every(gate => gate.ok);
  return { valid, errors, decisions: decisions.map(({ order, ...rest }) => rest), gates };
}

/** Reads only inside the run folder; absolute paths and .. segments are refused. */
function scopedReader(base) {
  const root = resolve(base);
  return async path => {
    if (isAbsolute(path)) throw new Error('absolute path');
    const target = resolve(root, path);
    const inside = relative(root, target);
    if (inside.startsWith('..') || isAbsolute(inside)) throw new Error('path escapes the run folder');
    return readFile(target);
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [runDir, ...rest] = process.argv.slice(2);
    if (!runDir) throw new Error('Usage: node check-decisions.mjs <run-dir> [--require kind:scopeId]...');
    const requirements = [];
    for (let index = 0; index < rest.length; index += 2) {
      if (rest[index] !== '--require' || !rest[index + 1]) throw new Error('Usage: node check-decisions.mjs <run-dir> [--require kind:scopeId]...');
      requirements.push(rest[index + 1]);
    }
    const document = JSON.parse(await readFile(resolve(runDir, 'decisions.json'), 'utf8'));
    const result = await checkDecisions(document, scopedReader(runDir), requirements);
    console.log(JSON.stringify(result));
    process.exitCode = result.valid ? 0 : 1;
  } catch (error) {
    console.log(JSON.stringify({ valid: false, errors: [error.message], decisions: [], gates: [] }));
    process.exitCode = 1;
  }
}
