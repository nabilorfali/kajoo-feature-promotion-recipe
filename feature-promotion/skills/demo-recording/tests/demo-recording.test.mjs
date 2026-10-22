import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { filterStorageState, validateShotList, validateSteps } = require('../scripts/record.cjs');
const { alignTiming, keepSegments, mapTime, clipSeconds, captionEvents, assTime, assEscape, buildAss, selectExpression } = await import('../scripts/encode.mjs');

const asset = name => JSON.parse(readFileSync(fileURLToPath(new URL(`../assets/${name}`, import.meta.url)), 'utf8'));
const shotList = asset('shot-list.example.json');
const steps = asset('steps.example.json');

test('the saved sign-in keeps only the app site cookies and storage', () => {
  const state = {
    cookies: [
      { name: '__session', domain: 'stage2.kajoo.ai' },
      { name: 'shared', domain: '.kajoo.ai' },
      { name: 'auth0', domain: 'login.kajoo.ai' },
      { name: 'other', domain: 'example.com' },
    ],
    origins: [{ origin: 'https://stage2.kajoo.ai', localStorage: [] }, { origin: 'https://login.kajoo.ai', localStorage: [] }],
  };
  const kept = filterStorageState(state, 'https://stage2.kajoo.ai');
  assert.deepEqual(kept.cookies.map(cookie => cookie.name), ['__session', 'shared']);
  assert.deepEqual(kept.origins.map(entry => entry.origin), ['https://stage2.kajoo.ai']);
  assert.throws(() => filterStorageState({ cookies: [{ name: 'x', domain: 'example.com' }] }, 'https://stage2.kajoo.ai'), /no cookies/);
  assert.throws(() => filterStorageState('not a sign-in', 'https://stage2.kajoo.ai'), /not a saved browser sign-in/);
});

test('the example shot list and steps are valid together', () => {
  assert.deepEqual(validateShotList(shotList), []);
  assert.deepEqual(validateSteps(steps, shotList), []);
});

test('steps must keep the approved captions and stay on the app', () => {
  const changed = structuredClone(steps);
  changed.steps[1].caption = 'Ask something else';
  assert.match(validateSteps(changed, shotList).join(' '), /match the approved shot list/);
  const offsite = structuredClone(steps);
  offsite.steps[0].actions[0] = { goto: 'https://example.com/' };
  assert.match(validateSteps(offsite, shotList).join(' '), /must stay on https:\/\/stage2\.kajoo\.ai/);
  const unknown = structuredClone(steps);
  unknown.steps[0].actions.push({ drag: {} });
  assert.match(validateSteps(unknown, shotList).join(' '), /exactly one of/);
  const noStart = structuredClone(steps);
  noStart.steps[0].actions.shift();
  assert.match(validateSteps(noStart, shotList).join(' '), /first action of the first step must be a goto/);
  const twoTargets = structuredClone(steps);
  twoTargets.steps[2].actions[0] = { hover: { role: 'button', text: 'Model' } };
  assert.match(validateSteps(twoTargets, shotList).join(' '), /exactly one of role/);
});

test('captions stay short', () => {
  const long = structuredClone(shotList);
  long.steps[0].caption = 'This caption has far too many words to read in a feed';
  assert.match(validateShotList(long).join(' '), /longer than 8 words/);
});

test('cuts and the blank start are removed, and times move with them', () => {
  const segments = keepSegments(3, 30, [[10, 18], [12, 14], [40, 50]]);
  assert.deepEqual(segments, [[3, 10], [18, 30]]);
  assert.equal(clipSeconds(segments), 19);
  assert.equal(mapTime(1, segments), 0);
  assert.equal(mapTime(5, segments), 2);
  assert.equal(mapTime(15, segments), 7);
  assert.equal(mapTime(20, segments), 9);
  assert.equal(selectExpression(segments), 'between(t,3.000,10.000)+between(t,18.000,30.000)');
  const events = captionEvents([
    { caption: 'One', start: 0, end: 9 },
    { caption: 'Hidden', start: 11, end: 17 },
    { caption: 'Two', start: 17, end: 30 },
  ], segments);
  assert.deepEqual(events.map(event => event.text), ['One', 'Two']);
});

test('the recorder clock is lined up with the shorter video', () => {
  const aligned = alignTiming({ trimStart: 2.5, end: 11.5, steps: [{ caption: 'One', start: 0, end: 4.5 }], cuts: [[8.8, 9.4]] }, 10);
  assert.equal(aligned.end, 10);
  assert.equal(aligned.trimStart, 1);
  assert.deepEqual(aligned.steps[0], { caption: 'One', start: 0, end: 3 });
  assert.deepEqual(aligned.cuts[0].map(value => Number(value.toFixed(2))), [7.3, 7.9]);
  assert.equal(alignTiming({ trimStart: 1, end: 9, steps: [], cuts: [] }, 10).trimStart, 1);
});

test('the subtitle file has both styles, the title and escaped captions', () => {
  assert.equal(assTime(62.345), '0:01:02.35');
  assert.equal(assEscape('A {b} \\ c'), 'A \\{b\\} \\\\ c');
  const wide = buildAss({ shape: '16x9', title: 'See it', events: [{ text: 'Ask {anything}', start: 1, end: 4 }], duration: 20 });
  assert.match(wide, /PlayResX: 1920/);
  assert.match(wide, /Dialogue: 1,0:00:00\.00,0:00:02\.50,Title,,0,0,0,,See it/);
  assert.match(wide, /Dialogue: 0,0:00:01\.00,0:00:04\.00,Caption,,0,0,0,,Ask \\\{anything\\\}/);
  const tall = buildAss({ shape: '4x5', title: 'See it', events: [], duration: 20 });
  assert.match(tall, /PlayResY: 1350/);
  assert.match(tall, /Title,,0,0,0,,See it/);
  assert.match(tall, /0:00:20\.00,Title/);
});
