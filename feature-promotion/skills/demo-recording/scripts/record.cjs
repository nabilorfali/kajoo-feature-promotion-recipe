'use strict';
// Records a demo of the Kajoo web app from a steps file, or probes one page so the recorder can plan steps.
//   node record.cjs probe  --sign-in <file> --url <url> --out <dir>
//   node record.cjs record --sign-in <file> --steps <steps.json> --shot-list <shot-list.json> --out <demo-dir>
const { readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, readdirSync } = require('node:fs');
const { join, resolve } = require('node:path');

const EXIT = { input: 2, signIn: 3, step: 4, egress: 5, limit: 6 };
const ACTION_KINDS = ['goto', 'click', 'hover', 'type', 'press', 'waitFor', 'pause', 'scroll'];
const TARGET_KEYS = ['role', 'text', 'label', 'placeholder', 'testId', 'selector'];
const MAX_STEPS = 12;
const MAX_CAPTION_WORDS = 8;
const RUN_LIMIT_MS = 240_000;
const DEFAULT_HOLD_MS = 1600;

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const words = value => value.trim().split(/\s+/).length;
const failure = (code, message) => Object.assign(new Error(message), { exitCode: code });

/** Keeps only the target app's own cookies and storage, so no identity-provider session reaches the browser. */
function filterStorageState(state, baseUrl) {
  if (!object(state) || !Array.isArray(state.cookies)) throw failure(EXIT.signIn, 'The sign-in file is not a saved browser sign-in.');
  const { hostname, origin } = new URL(baseUrl);
  const cookies = state.cookies.filter(cookie => {
    const domain = String(cookie?.domain ?? '').replace(/^\./, '').toLowerCase();
    return domain.length > 0 && (hostname === domain || hostname.endsWith(`.${domain}`));
  });
  const origins = (Array.isArray(state.origins) ? state.origins : []).filter(entry => entry?.origin === origin);
  if (!cookies.length) throw failure(EXIT.signIn, `The sign-in file has no cookies for ${hostname}.`);
  return { cookies, origins };
}

const targetErrors = (where, target) => {
  if (!object(target)) return [`${where}: needs a target object.`];
  const keys = TARGET_KEYS.filter(key => key in target);
  if (keys.length !== 1 || !text(target[keys[0]])) return [`${where}: needs exactly one of ${TARGET_KEYS.join(', ')}.`];
  if ('name' in target && (keys[0] !== 'role' || !text(target.name))) return [`${where}: name goes only with role.`];
  return [];
};

/** Shot list approved by the user: what each step shows and its caption. */
function validateShotList(doc) {
  const errors = [];
  if (!object(doc) || doc.version !== 1 || !text(doc.title) || !Array.isArray(doc.steps)) return ['The shot list needs version 1, a title and steps.'];
  if (!doc.steps.length || doc.steps.length > MAX_STEPS) errors.push(`The shot list needs 1 to ${MAX_STEPS} steps.`);
  doc.steps.forEach((step, index) => {
    if (!object(step) || !text(step.shows) || !text(step.caption)) errors.push(`Shot ${index + 1}: needs shows and caption.`);
    else if (words(step.caption) > MAX_CAPTION_WORDS) errors.push(`Shot ${index + 1}: caption is longer than ${MAX_CAPTION_WORDS} words.`);
  });
  return errors;
}

/** Steps the recorder runs. Captions must match the approved shot list, in order. */
function validateSteps(doc, shotList) {
  const errors = [];
  if (!object(doc) || doc.version !== 1 || !text(doc.baseUrl) || !text(doc.title) || !Array.isArray(doc.steps)) {
    return ['The steps file needs version 1, a baseUrl, a title and steps.'];
  }
  let origin;
  try {
    const url = new URL(doc.baseUrl);
    if (url.protocol !== 'https:') errors.push('baseUrl must be https.');
    origin = url.origin;
  } catch {
    return ['baseUrl is not a URL.'];
  }
  if (!doc.steps.length || doc.steps.length > MAX_STEPS) errors.push(`Use 1 to ${MAX_STEPS} steps.`);
  // The clip is trimmed to start when the first page has loaded.
  if (!object(doc.steps[0]?.actions?.[0]) || !('goto' in doc.steps[0].actions[0])) errors.push('The first action of the first step must be a goto.');
  doc.steps.forEach((step, index) => {
    const where = `Step ${index + 1}`;
    if (!object(step) || !text(step.caption) || !Array.isArray(step.actions) || !step.actions.length) {
      errors.push(`${where}: needs a caption and actions.`);
      return;
    }
    if (words(step.caption) > MAX_CAPTION_WORDS) errors.push(`${where}: caption is longer than ${MAX_CAPTION_WORDS} words.`);
    if ('hold' in step && !(Number.isFinite(step.hold) && step.hold >= 0 && step.hold <= 10_000)) errors.push(`${where}: hold is 0 to 10000 ms.`);
    step.actions.forEach((action, actionIndex) => {
      const at = `${where} action ${actionIndex + 1}`;
      const kinds = object(action) ? ACTION_KINDS.filter(kind => kind in action) : [];
      if (kinds.length !== 1) {
        errors.push(`${at}: needs exactly one of ${ACTION_KINDS.join(', ')}.`);
        return;
      }
      if ('cut' in action && typeof action.cut !== 'boolean') errors.push(`${at}: cut is true or false.`);
      const value = action[kinds[0]];
      switch (kinds[0]) {
        case 'goto': {
          if (!text(value)) errors.push(`${at}: goto needs a path or URL.`);
          else if (new URL(value, doc.baseUrl).origin !== origin) errors.push(`${at}: goto must stay on ${origin}.`);
          break;
        }
        case 'click':
        case 'hover':
          errors.push(...targetErrors(at, value));
          break;
        case 'type':
          if (!object(value) || typeof value.text !== 'string' || value.text.length > 200) errors.push(`${at}: type needs text of at most 200 characters.`);
          else if ('target' in value) errors.push(...targetErrors(at, value.target));
          break;
        case 'press':
          if (!text(value)) errors.push(`${at}: press needs a key.`);
          break;
        case 'waitFor':
          errors.push(...targetErrors(at, value));
          if (object(value) && 'timeout' in value && !(Number.isFinite(value.timeout) && value.timeout > 0 && value.timeout <= 90_000)) {
            errors.push(`${at}: timeout is up to 90000 ms.`);
          }
          break;
        case 'pause':
          if (!(Number.isFinite(value) && value >= 0 && value <= 10_000)) errors.push(`${at}: pause is 0 to 10000 ms.`);
          break;
        case 'scroll':
          if (!object(value) || !Number.isFinite(value.y)) errors.push(`${at}: scroll needs a y offset.`);
          break;
      }
    });
  });
  if (shotList) {
    const approved = Array.isArray(shotList.steps) ? shotList.steps.map(step => step?.caption) : [];
    const recorded = doc.steps.map(step => step?.caption);
    if (approved.length !== recorded.length || approved.some((caption, index) => caption !== recorded[index])) {
      errors.push('Captions must match the approved shot list exactly and in order.');
    }
  }
  return errors;
}

// Runs in the page: headless recordings have no cursor, so draw one. Re-attached if the app replaces body content.
const CURSOR = () => {
  if (document.getElementById('__demo_cursor')) return;
  const dot = document.createElement('div');
  dot.id = '__demo_cursor';
  dot.style.cssText = 'position:fixed;z-index:2147483647;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;background:rgba(98,84,240,.30);border:2px solid #6254f0;pointer-events:none;transition:transform .08s;left:-60px;top:-60px';
  const attach = () => { if (!dot.isConnected && document.body) document.body.append(dot); };
  attach();
  new MutationObserver(attach).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('mousemove', event => { dot.style.left = `${event.clientX}px`; dot.style.top = `${event.clientY}px`; }, true);
  addEventListener('mousedown', () => { dot.style.transform = 'scale(.7)'; }, true);
  addEventListener('mouseup', () => { dot.style.transform = 'scale(1)'; }, true);
};

const locate = (page, target) => {
  if (target.role) return page.getByRole(target.role, target.name ? { name: target.name, exact: Boolean(target.exact) } : {}).first();
  if (target.label) return page.getByLabel(target.label, { exact: Boolean(target.exact) }).first();
  if (target.placeholder) return page.getByPlaceholder(target.placeholder, { exact: Boolean(target.exact) }).first();
  if (target.testId) return page.getByTestId(target.testId).first();
  if (target.text) return page.getByText(target.text, { exact: Boolean(target.exact) }).first();
  return page.locator(target.selector).first();
};

const moveTo = async (page, locator) => {
  await locator.waitFor({ state: 'visible', timeout: 15_000 });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
};

const signedOut = (page, baseUrl) => {
  const url = new URL(page.url());
  return url.origin !== new URL(baseUrl).origin || url.pathname.startsWith('/auth/login');
};

async function runAction(page, action, baseUrl) {
  if ('goto' in action) {
    await page.goto(new URL(action.goto, baseUrl).href, { waitUntil: 'load', timeout: 45_000 });
    await page.evaluate(CURSOR).catch(() => undefined);
    if (signedOut(page, baseUrl)) throw failure(EXIT.signIn, 'The saved sign-in is expired or rejected; the app sent the browser to sign in.');
  } else if ('click' in action) {
    const locator = locate(page, action.click);
    await moveTo(page, locator);
    await page.waitForTimeout(250);
    await locator.click();
  } else if ('hover' in action) {
    await moveTo(page, locate(page, action.hover));
  } else if ('type' in action) {
    if (action.type.target) {
      const locator = locate(page, action.type.target);
      await moveTo(page, locator);
      await locator.click();
    }
    await page.keyboard.type(action.type.text, { delay: action.type.delay ?? 45 });
  } else if ('press' in action) {
    await page.keyboard.press(action.press);
  } else if ('waitFor' in action) {
    await locate(page, action.waitFor).waitFor({ state: 'visible', timeout: action.waitFor.timeout ?? 30_000 });
  } else if ('pause' in action) {
    await page.waitForTimeout(action.pause);
  } else if ('scroll' in action) {
    await page.mouse.wheel(0, action.scroll.y);
    await page.waitForTimeout(400);
  }
}

const loadPlaywright = () => {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/playwright-browsers';
  try {
    return require('playwright');
  } catch {
    return require(require.resolve('playwright', { paths: ['/usr/local/lib/node_modules'] }));
  }
};

async function checkEgress(baseUrl) {
  try {
    await fetch(baseUrl, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(15_000) });
  } catch {
    throw failure(EXIT.egress, `Cannot reach ${new URL(baseUrl).host} from the sandbox. Run sudo /usr/local/bin/start-proxy.sh, then try again.`);
  }
}

const readJson = (path, what) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw failure(what === 'sign-in' ? EXIT.signIn : EXIT.input, `Cannot read the ${what} file: ${error.code ?? error.message}`);
  }
};

async function withLimit(work) {
  let timer;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(failure(EXIT.limit, `Stopped after ${RUN_LIMIT_MS / 1000} seconds; shorten the steps or the waits.`)), RUN_LIMIT_MS);
  });
  try {
    return await Promise.race([work(), limit]);
  } finally {
    clearTimeout(timer);
  }
}

async function probe({ signIn, url, out }) {
  const target = new URL(url);
  const storageState = filterStorageState(readJson(signIn, 'sign-in'), target.origin);
  await checkEgress(target.origin);
  mkdirSync(out, { recursive: true });
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, storageState });
    const page = await context.newPage();
    await page.goto(target.href, { waitUntil: 'load', timeout: 45_000 });
    await page.waitForTimeout(1500);
    const aria = (await page.locator('body').ariaSnapshot()).slice(0, 60_000);
    writeFileSync(join(out, 'probe-aria.txt'), aria);
    await page.screenshot({ path: join(out, 'probe.png') });
    return { ok: true, url: page.url(), title: await page.title(), signedIn: !signedOut(page, target.origin), screenshot: join(out, 'probe.png'), aria: join(out, 'probe-aria.txt') };
  } finally {
    await browser.close();
  }
}

async function record({ signIn, steps: stepsPath, shotList: shotListPath, out }) {
  const doc = readJson(stepsPath, 'steps');
  const shotList = readJson(shotListPath, 'shot list');
  const errors = [...validateShotList(shotList), ...validateSteps(doc, shotList)];
  if (errors.length) throw failure(EXIT.input, errors.join(' '));
  const storageState = filterStorageState(readJson(signIn, 'sign-in'), doc.baseUrl);
  await checkEgress(doc.baseUrl);
  const rawDir = join(out, 'raw');
  rmSync(rawDir, { recursive: true, force: true });
  mkdirSync(rawDir, { recursive: true });
  const viewport = { width: 1280, height: 720 };
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport, storageState, recordVideo: { dir: rawDir, size: viewport } });
  const timing = { version: 1, title: doc.title, baseUrl: doc.baseUrl, video: 'raw/raw.webm', viewport, trimStart: 0, end: 0, steps: [], cuts: [] };
  let page;
  let t0 = Date.now();
  const now = () => (Date.now() - t0) / 1000;
  try {
    page = await context.newPage();
    t0 = Date.now();
    page.on('load', () => page.evaluate(CURSOR).catch(() => undefined));
    for (const [index, step] of doc.steps.entries()) {
      const start = now();
      for (const action of step.actions) {
        const actionStart = now();
        try {
          await runAction(page, action, doc.baseUrl);
        } catch (error) {
          await page.screenshot({ path: join(out, `failed-step-${index + 1}.png`) }).catch(() => undefined);
          if (error.exitCode) throw error;
          throw failure(EXIT.step, `Step ${index + 1} ("${step.caption}") failed: ${error.message.split('\n')[0]}`);
        }
        if (action.cut) timing.cuts.push([actionStart, now()]);
        if (index === 0 && 'goto' in action && !timing.trimStart) timing.trimStart = now() + 0.3;
      }
      await page.waitForTimeout(step.hold ?? DEFAULT_HOLD_MS);
      timing.steps.push({ caption: step.caption, start, end: now() });
    }
    timing.end = now();
  } finally {
    await context.close();
    await browser.close();
  }
  const video = readdirSync(rawDir).find(name => name.endsWith('.webm'));
  if (!video) throw failure(EXIT.step, 'The browser closed without writing a video.');
  renameSync(join(rawDir, video), join(rawDir, 'raw.webm'));
  writeFileSync(join(out, 'timing.json'), JSON.stringify(timing, null, 2) + '\n');
  return { ok: true, timing: join(out, 'timing.json'), video: join(out, timing.video), seconds: Number(timing.end.toFixed(1)), steps: timing.steps.length, cuts: timing.cuts.length };
}

const parseArgs = argv => {
  const [mode, ...rest] = argv;
  const options = { mode };
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index]?.replace(/^--/, '').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (!key || rest[index + 1] === undefined) throw failure(EXIT.input, `Missing value for ${rest[index]}.`);
    options[key] = resolve(rest[index + 1]);
    if (key === 'url') options.url = rest[index + 1];
  }
  return options;
};

module.exports = { filterStorageState, validateShotList, validateSteps, ACTION_KINDS, MAX_CAPTION_WORDS };

if (require.main === module) {
  (async () => {
    const options = parseArgs(process.argv.slice(2));
    const need = { probe: ['signIn', 'url', 'out'], record: ['signIn', 'steps', 'shotList', 'out'] }[options.mode];
    if (!need) throw failure(EXIT.input, 'Usage: record.cjs probe|record --sign-in <file> ... --out <dir>');
    const missing = need.filter(key => !options[key]);
    if (missing.length) throw failure(EXIT.input, `Missing ${missing.join(', ')}.`);
    const result = await withLimit(() => (options.mode === 'probe' ? probe(options) : record(options)));
    console.log(JSON.stringify(result));
  })().catch(error => {
    console.log(JSON.stringify({ ok: false, code: error.exitCode ?? 1, error: error.message.split('\n')[0] }));
    // Exit at once: after a time limit the browser may still be running.
    process.exit(error.exitCode ?? 1);
  });
}
