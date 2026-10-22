// Turns a raw recording into the 16:9 and 4:5 clips with captions, a cover image and check frames.
//   node encode.mjs <demo-dir>
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const RECORDED_FPS = 25;
const TITLE_SECONDS = 2.5;
const MIN_SECONDS = 5;
const MAX_SECONDS = 90;

export const SHAPES = {
  '16x9': { file: 'demo-16x9.mp4', width: 1920, height: 1080, scale: 'scale=1920:1080:flags=lanczos,setsar=1' },
  '4x5': { file: 'demo-4x5.mp4', width: 1080, height: 1350, scale: 'scale=1080:-2:flags=lanczos,pad=1080:1350:0:(oh-ih)/2:color=0x14141E,setsar=1' },
};

/**
 * The video starts a moment after the recorder's clock does, and ends when the browser closes.
 * Line the clock up with the video by its length.
 */
export function alignTiming(timing, videoSeconds) {
  const offset = Math.max(0, timing.end - videoSeconds);
  const at = value => Math.max(0, value - offset);
  return {
    ...timing,
    trimStart: at(timing.trimStart),
    end: videoSeconds,
    steps: timing.steps.map(step => ({ ...step, start: at(step.start), end: at(step.end) })),
    cuts: timing.cuts.map(([from, to]) => [at(from), at(to)]),
  };
}

/** Parts of the raw video to keep: from trimStart to end, without the cut ranges. */
export function keepSegments(trimStart, end, cuts = []) {
  const merged = cuts
    .map(([from, to]) => [Math.max(from, trimStart), Math.min(to, end)])
    .filter(([from, to]) => to > from)
    .sort((a, b) => a[0] - b[0])
    .reduce((list, range) => {
      const last = list.at(-1);
      if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
      else list.push([...range]);
      return list;
    }, []);
  const segments = [];
  let cursor = trimStart;
  for (const [from, to] of merged) {
    if (from > cursor) segments.push([cursor, from]);
    cursor = Math.max(cursor, to);
  }
  if (end > cursor) segments.push([cursor, end]);
  return segments.filter(([from, to]) => to - from >= 0.04);
}

/** Where a raw time lands in the cut clip. A time inside a cut lands where the clip resumes. */
export function mapTime(time, segments) {
  let out = 0;
  for (const [from, to] of segments) {
    if (time <= from) return out;
    if (time < to) return out + (time - from);
    out += to - from;
  }
  return out;
}

export const clipSeconds = segments => segments.reduce((sum, [from, to]) => sum + (to - from), 0);

/** Caption timings in the cut clip; captions that end up shorter than 0.3 s are dropped. */
export function captionEvents(steps, segments) {
  return steps
    .map(step => ({ text: step.caption, start: mapTime(step.start, segments), end: mapTime(step.end, segments) }))
    .filter(event => event.end - event.start >= 0.3);
}

export function assTime(seconds) {
  const centis = Math.max(0, Math.round(seconds * 100));
  const h = Math.floor(centis / 360000);
  const m = Math.floor((centis % 360000) / 6000);
  const s = Math.floor((centis % 6000) / 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(centis % 100).padStart(2, '0')}`;
}

export const assEscape = value => value.replace(/\\/g, '\\\\').replace(/[{}]/g, match => `\\${match}`).replace(/\r?\n/g, '\\N');

/** Subtitle file for one shape: a title and one caption per step. */
export function buildAss({ shape, title, events, duration }) {
  const { width, height } = SHAPES[shape];
  const wide = shape === '16x9';
  const caption = wide ? 'Caption,DejaVu Sans,46,&H00FFFFFF,&H00FFFFFF,&H33141414,&H33141414,1,0,0,0,100,100,0,0,3,16,0,2,120,120,64,1'
    : 'Caption,DejaVu Sans,54,&H00FFFFFF,&H00FFFFFF,&H00141414,&H00141414,1,0,0,0,100,100,0,0,1,0,0,2,70,70,150,1';
  const heading = wide ? 'Title,DejaVu Sans,58,&H00FFFFFF,&H00FFFFFF,&H33141414,&H33141414,1,0,0,0,100,100,0,0,3,20,0,8,120,120,70,1'
    : 'Title,DejaVu Sans,56,&H00FFFFFF,&H00FFFFFF,&H00141414,&H00141414,1,0,0,0,100,100,0,0,1,0,0,8,70,70,150,1';
  const titleEnd = wide ? Math.min(TITLE_SECONDS, duration) : duration;
  return [
    '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${width}`, `PlayResY: ${height}`, 'WrapStyle: 0', 'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: ${caption}`, `Style: ${heading}`, '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    `Dialogue: 1,${assTime(0)},${assTime(titleEnd)},Title,,0,0,0,,${assEscape(title)}`,
    ...events.map(event => `Dialogue: 0,${assTime(event.start)},${assTime(event.end)},Caption,,0,0,0,,${assEscape(event.text)}`),
    '',
  ].join('\n');
}

export const selectExpression = segments => segments.map(([from, to]) => `between(t,${from.toFixed(3)},${to.toFixed(3)})`).join('+');

function findFfmpeg() {
  const candidates = [process.env.FFMPEG, 'ffmpeg'];
  const fromPip = () => spawnSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' }).stdout?.trim();
  for (const attempt of [() => candidates, () => [fromPip()], () => {
    spawnSync('python3', ['-m', 'pip', 'install', '--quiet', '--user', 'imageio-ffmpeg'], { stdio: 'ignore', timeout: 120_000 });
    return [fromPip()];
  }]) {
    for (const bin of attempt()) {
      if (!bin) continue;
      const probe = spawnSync(bin, ['-hide_banner', '-filters'], { encoding: 'utf8' });
      if (probe.status === 0 && / subtitles /.test(probe.stdout)) return bin;
    }
  }
  throw new Error('No ffmpeg with subtitle support. Run: python3 -m pip install --user imageio-ffmpeg');
}

const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');

const videoSeconds = (ffmpeg, path) => {
  const match = spawnSync(ffmpeg, ['-hide_banner', '-i', path], { encoding: 'utf8' }).stderr.match(/Duration: (\d+):(\d+):([\d.]+)/);
  if (!match) throw new Error(`Cannot read the length of ${path}.`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
};

function encode(dir) {
  const ffmpeg = findFfmpeg();
  const recorded = JSON.parse(readFileSync(join(dir, 'timing.json'), 'utf8'));
  const timing = alignTiming(recorded, videoSeconds(ffmpeg, join(dir, recorded.video)));
  const segments = keepSegments(timing.trimStart, timing.end, timing.cuts);
  const duration = clipSeconds(segments);
  if (duration < MIN_SECONDS || duration > MAX_SECONDS) throw new Error(`The clip would be ${duration.toFixed(1)} s; it must be ${MIN_SECONDS} to ${MAX_SECONDS} s. Change the waits or cuts.`);
  const events = captionEvents(timing.steps, segments);
  const run = args => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { cwd: dir, stdio: ['ignore', 'ignore', 'pipe'] });
  const select = `select='${selectExpression(segments)}',setpts=N/${RECORDED_FPS}/TB`;
  for (const [shape, spec] of Object.entries(SHAPES)) {
    writeFileSync(join(dir, `captions-${shape}.ass`), buildAss({ shape, title: timing.title, events, duration }));
    run(['-i', timing.video, '-vf', `${select},${spec.scale},subtitles=captions-${shape}.ass,fps=30,format=yuv420p`,
      '-an', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart', spec.file]);
  }
  const last = events.at(-1);
  const coverAt = last ? (last.start + last.end) / 2 : duration / 2;
  run(['-ss', coverAt.toFixed(2), '-i', SHAPES['16x9'].file, '-frames:v', '1', 'cover.png']);
  rmSync(join(dir, 'frames'), { recursive: true, force: true });
  mkdirSync(join(dir, 'frames'));
  const checks = [['first', 0.2], ...events.map((event, index) => [`step-${index + 1}`, (event.start + event.end) / 2]), ['last', Math.max(0, duration - 0.3)]];
  for (const [name, at] of checks) run(['-ss', at.toFixed(2), '-i', SHAPES['16x9'].file, '-frames:v', '1', '-vf', 'scale=960:-2', `frames/${name}.png`]);
  const files = Object.fromEntries([...Object.values(SHAPES).map(spec => spec.file), 'cover.png'].map(file => [file, { bytes: statSync(join(dir, file)).size, sha256: sha256(join(dir, file)) }]));
  const round = value => Number(value.toFixed(2));
  const captions = events.map(event => ({ text: event.text, start: round(event.start), end: round(event.end) }));
  const report = { version: 1, title: timing.title, seconds: round(duration), captions, files, frames: checks.map(([name]) => `frames/${name}.png`) };
  writeFileSync(join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [dir, ...extra] = process.argv.slice(2);
    if (!dir || extra.length) throw new Error('Usage: node encode.mjs <demo-dir>');
    const report = encode(resolve(dir));
    console.log(JSON.stringify({ ok: true, seconds: report.seconds, files: Object.keys(report.files), frames: report.frames.length }));
  } catch (error) {
    const detail = error.stderr ? String(error.stderr).trim().split('\n').slice(-2).join(' ') : error.message;
    console.log(JSON.stringify({ ok: false, error: detail }));
    process.exitCode = 1;
  }
}
