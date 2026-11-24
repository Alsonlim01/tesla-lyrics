// Line up lyric lines with a recording, using a speech-recognition transcript with word timings.
// Prints only line numbers and times (no lyric text), ready to paste into api/_timings.js.
//
// node tools/align.mjs <lrc.json from the relay> <words.json from faster-whisper> [lead seconds]
//
// The transcript is matched to the lyrics character by character, comparing pinyin so a misheard
// character with the same sound still counts. Live versions often repeat or skip lines, so after
// any line the alignment may jump to any other line (at a small cost) instead of only the next one.
import fs from 'fs';
import { pinyin } from 'pinyin-pro';
import { toSimp } from '../api/_t2s.js';

const [lrcFile, wordsFile, leadArg] = process.argv.slice(2);
const LEAD = Number(leadArg || 0.15); // light a line slightly before the first sung syllable is detected
const relay = JSON.parse(fs.readFileSync(lrcFile, 'utf8'));
const words = JSON.parse(fs.readFileSync(wordsFile, 'utf8'));

const keep = c => /[\p{Script=Han}\p{L}\p{N}]/u.test(c);
const py = c => /\p{Script=Han}/u.test(c) ? pinyin(c, { toneType: 'none' }) : c.toLowerCase();

// Lyric lines (text only matters here, the times are what we're after).
const lines = relay.lrc.split('\n').map(l => l.replace(/\[[^\]]*\]/g, '').trim()).filter(Boolean);
const L = [], lineStart = [], lineEnd = [];
lines.forEach((text, li) => {
  lineStart.push(L.length);
  for (const c of [...toSimp(text)]) if (keep(c)) L.push({ c, p: py(c), li });
  lineEnd.push(L.length - 1);
});
// Transcript characters, each with a time spread across its word.
const T = [];
for (const [s, e, w] of words) {
  const cs = [...toSimp(w)].filter(keep);
  cs.forEach((c, k) => T.push({ c, p: py(c), t: s + (e - s) * k / cs.length }));
}

const n = T.length, m = L.length;
const MATCH = 2, NEAR = 1, MISS = -1.5, GAP_T = -0.6, GAP_L = -1, JUMP = -4;
const sim = (a, b) => a.c === b.c ? MATCH : a.p === b.p ? MATCH - 0.3 : a.p[0] === b.p[0] && a.p.slice(-2) === b.p.slice(-2) ? NEAR : MISS;
const isStart = new Uint8Array(m); lineStart.forEach(j => isStart[j] = 1);
const isEnd = new Uint8Array(m); lineEnd.forEach(j => isEnd[j] = 1);
// D[i][j]: best score with transcript[0..i) used and lyric char j-1 the last one reached.
const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(-1e9));
const B = Array.from({ length: n + 1 }, () => new Int32Array(m + 1).fill(-9)); // back-pointer kind
const J = Array.from({ length: n + 1 }, () => new Int32Array(m + 1)); // jump source j
for (let i = 0; i <= n; i++) D[i][0] = i * GAP_T * 0.2; // music before singing is cheap to skip
for (let i = 0; i <= n; i++) {
  // Best place to have just finished a line, for jumps into other lines.
  let bestEnd = i === 0 ? 0 : -1e9, bestEndJ = 0;
  for (let j = 1; j <= m; j++) if (isEnd[j - 1] && D[i][j] > bestEnd) { bestEnd = D[i][j]; bestEndJ = j; }
  for (let j = 1; j <= m; j++) {
    if (i === 0 && j === 0) continue;
    let best = D[i][j], kind = B[i][j];
    if (i > 0) {
      const s = sim(T[i - 1], L[j - 1]);
      if (D[i - 1][j - 1] + s > best) { best = D[i - 1][j - 1] + s; kind = 0; }
      if (D[i - 1][j] + GAP_T > best) { best = D[i - 1][j] + GAP_T; kind = 1; }
      // Jump: start line at j-1 straight after any finished line (or from the very start).
      if (isStart[j - 1] && i > 0) {
        let be = -1e9, bj = 0;
        for (let q = 0; q <= m; q++) if ((q === 0 || isEnd[q - 1]) && D[i - 1][q] > be) { be = D[i - 1][q]; bj = q; }
        if (be + JUMP + s > best) { best = be + JUMP + s; kind = 3; J[i][j] = bj; }
      }
    }
    if (D[i][j - 1] + GAP_L > best) { best = D[i][j - 1] + GAP_L; kind = 2; }
    D[i][j] = best; B[i][j] = kind;
  }
}
// End anywhere after a finished line (live versions often end with extra ad-libs).
let i = n, j = 0, best = -1e9;
for (let q = 0; q <= m; q++) if ((q === 0 || isEnd[q - 1]) && D[n][q] > best) { best = D[n][q]; j = q; }
const hits = []; // [transcript index, lyric char index]
while (i > 0 && j > 0) {
  const k = B[i][j];
  if (k === 0) { hits.push([i - 1, j - 1]); i--; j--; }
  else if (k === 3) { hits.push([i - 1, j - 1]); const q = J[i][j]; i--; j = q; }
  else if (k === 1) i--;
  else if (k === 2) j--;
  else break;
}
hits.reverse();
// Each run of hits inside one line is one time that line is sung.
const sung = [];
for (const [ti, lj] of hits) {
  const li = L[lj].li, last = sung.at(-1);
  const good = sim(T[ti], L[lj]) > 0;
  if (!last || last.li !== li || lj < last.lastJ) sung.push({ li, t: T[ti].t, firstJ: lj, lastJ: lj, good: +good });
  else { last.lastJ = lj; last.good += good; if (!last.good && good) last.t = T[ti].t; }
}
const out = [];
for (const s of sung) {
  const len = lineEnd[s.li] - lineStart[s.li] + 1;
  if (s.good < Math.max(2, len * 0.35)) continue; // too little of the line was really heard
  // If the first few characters weren't heard, start a little earlier.
  const t = Math.max(0, s.t - (s.firstJ - lineStart[s.li]) * 0.25 - LEAD);
  if (out.length && t <= out.at(-1)[1]) continue;
  out.push([s.li, +t.toFixed(2)]);
}
if (process.env.DIAG) {
  // Per sung line: how much of it was heard; and stretches of singing no line claimed.
  for (const s of sung) console.error('line', s.li, 't', s.t.toFixed(1), 'heard', s.good + '/' + (lineEnd[s.li] - lineStart[s.li] + 1));
  const used = new Set(hits.map(h => h[0]));
  let run = [];
  const flush = () => { if (run.length >= 5) console.error('UNCLAIMED', T[run[0]].t.toFixed(1) + '-' + T[run.at(-1)].t.toFixed(1), run.length + ' chars'); run = []; };
  T.forEach((_, k) => used.has(k) ? flush() : run.push(k)); flush();
}
const coverage = new Set(out.map(o => o[0])).size;
console.error(`transcript ${n} chars, lyrics ${m} chars in ${lines.length} lines; ${out.length} sung lines, ${coverage}/${lines.length} lines used`);
console.log(JSON.stringify(out));
