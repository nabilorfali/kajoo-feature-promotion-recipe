import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const outcomes = ['success', 'failed', 'blocked', 'needs-redo', 'skipped'];
const fields = ['taskId', 'outcome', 'summary', 'evidence', 'changedFiles', 'checkpoint', 'unresolved'];

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

/** Reads only inside the run folder; absolute paths and paths that leave it are refused. */
export function scopedReader(base) {
  const root = resolve(base);
  return async path => {
    if (!text(path) || isAbsolute(path)) throw new Error(`${path}: must be a path inside the run folder`);
    const inside = relative(root, resolve(root, path));
    if (inside.startsWith('..') || isAbsolute(inside)) throw new Error(`${path}: leaves the run folder`);
    return readFile(resolve(root, path));
  };
}

/**
 * Checks one worker's TASK_RESULT against the task it was given. Never writes.
 * `expectedTaskId` is the workflow task the orchestrator dispatched. Evidence hashes must match the files now.
 */
export async function validateTaskResult(result, expectedTaskId, readBytes) {
  const errors = [];
  if (!object(result)) return { valid: false, errors: ['The result must be a JSON object.'] };
  for (const key of Object.keys(result)) if (!fields.includes(key)) errors.push(`Unknown field: ${key}`);
  if (result.taskId !== expectedTaskId) errors.push(`taskId must be ${expectedTaskId}`);
  if (!outcomes.includes(result.outcome)) errors.push(`outcome must be one of ${outcomes.join(', ')}`);
  if (!text(result.summary)) errors.push('summary is required');
  if (result.checkpoint !== null) errors.push('checkpoint must be null; promotion workers change no repository');
  for (const name of ['evidence', 'changedFiles', 'unresolved']) if (!Array.isArray(result[name])) errors.push(`${name} must be an array`);
  if (errors.length) return { valid: false, errors };

  for (const entry of result.evidence) {
    if (!object(entry) || !text(entry.kind) || !text(entry.path) || !/^[a-f0-9]{64}$/.test(entry.sha256 ?? '') || !text(entry.observation)) {
      errors.push('Each evidence entry needs kind, path, sha256 and observation.');
      continue;
    }
    try {
      if (digest(await readBytes(entry.path)) !== entry.sha256) errors.push(`${entry.path}: changed since the result was written`);
    } catch (error) {
      errors.push(`${entry.path}: ${error.message.includes('run folder') ? error.message : 'missing'}`);
    }
  }
  for (const path of result.changedFiles) {
    try {
      await readBytes(path);
    } catch {
      errors.push(`${path}: listed as changed but not found in the run folder`);
    }
  }
  if (!result.unresolved.every(text)) errors.push('unresolved entries must be non-empty text');
  if (result.outcome === 'success' && result.unresolved.length) errors.push('A successful result cannot leave acceptance gaps unresolved.');
  if (result.outcome === 'success' && !result.evidence.length) errors.push('A successful result needs at least one evidence entry.');
  return { valid: errors.length === 0, errors };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [runDir, resultPath, flag, taskId, ...extra] = process.argv.slice(2);
    if (!runDir || !resultPath || flag !== '--task' || !taskId || extra.length) {
      throw new Error('Usage: node validate-task-result.mjs <run-dir> <result-path-in-run-dir> --task <workflow-task-id>');
    }
    const read = scopedReader(runDir);
    const result = JSON.parse(await read(resultPath));
    const report = await validateTaskResult(result, taskId, read);
    console.log(JSON.stringify({ ...report, taskId, outcome: result.outcome ?? null }));
    process.exitCode = report.valid ? 0 : 1;
  } catch (error) {
    console.log(JSON.stringify({ valid: false, errors: [error.message] }));
    process.exitCode = 1;
  }
}
