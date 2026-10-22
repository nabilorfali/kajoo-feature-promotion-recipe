import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const types = ['added', 'improved', 'fixed'];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const placeholder = /\b(TBD|TODO|FIXME|lorem ipsum)\b|\[\s*(?:confirm|todo|tbd|insert)[^\]]*\]/i;
const ticketKey = /\b[A-Z][A-Z0-9]+-\d+\b/;

/** Splits a draft into its header and body. The header is simple key: value lines between --- lines. */
export function parseDraft(source) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source.replace(/\r\n/g, '\n'));
  if (!match) throw new Error('Draft must start with a --- header and end it with ---.');
  const header = {};
  for (const line of match[1].split('\n')) {
    const entry = /^([a-z]+):\s*(.*)$/.exec(line);
    if (!entry) throw new Error(`Unreadable header line: ${line}`);
    header[entry[1]] = entry[2].trim();
  }
  return { header, body: match[2].trim() };
}

/** Builds the exact request body for creating a hidden ReadMe changelog entry, or throws with every problem found. */
export function buildCreateRequest(source) {
  const { header, body } = parseDraft(source);
  const problems = [];
  const title = header.title ?? '';
  if (!title || title.length > 90) problems.push('title must be 1 to 90 characters');
  if (/[.!?]$/.test(title)) problems.push('title must not end with punctuation');
  if (!types.includes(header.type)) problems.push(`type must be one of ${types.join(', ')}`);
  if (!slugPattern.test(header.slug ?? '')) problems.push('slug must be lowercase words joined by dashes');
  const keys = (header.stories ?? '').match(/[A-Z][A-Z0-9]*-\d+/g) ?? [];
  if (keys.some(key => (header.slug ?? '').includes(key.toLowerCase()))) problems.push('slug must not contain a ticket key');
  if (!/^\[[A-Z][A-Z0-9]*-\d+(?:,\s*[A-Z][A-Z0-9]*-\d+)*\]$/.test(header.stories ?? '')) problems.push('stories must look like [KEY-1, KEY-2]');
  if (!body || body.length > 4000) problems.push('body must be 1 to 4000 characters');
  if (ticketKey.test(title) || ticketKey.test(body)) problems.push('title and body must not contain ticket keys');
  if (placeholder.test(title) || placeholder.test(body)) problems.push('title and body must not contain placeholders');
  if (/\b(soon|coming|will be|upcoming|roadmap)\b/i.test(body)) problems.push('body must describe shipped work, not future plans');
  if (problems.length) throw new Error(problems.join('; '));
  return {
    title,
    slug: header.slug,
    type: header.type,
    content: { body },
    privacy: { view: 'anyone_with_link' },
    allow_crawlers: 'disabled',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [draft, flag, out, ...extra] = process.argv.slice(2);
    if (!draft || flag !== '--out' || !out || extra.length) throw new Error('Usage: node build-readme-request.mjs <changelog.md> --out <readme-create.json>');
    const request = buildCreateRequest(await readFile(resolve(draft), 'utf8'));
    await writeFile(resolve(out), JSON.stringify(request, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ valid: true, slug: request.slug, type: request.type, bodyCharacters: request.content.body.length, out: resolve(out) }));
  } catch (error) {
    console.log(JSON.stringify({ valid: false, errors: [error.message] }));
    process.exitCode = 1;
  }
}
