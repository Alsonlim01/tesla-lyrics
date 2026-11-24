// Chinese-lyrics relay for the Tesla lyrics page.
// NetEase Cloud Music has far better coverage of Chinese songs than LRCLIB, but it doesn't let web
// pages read its data directly (no CORS). This function looks the song up on NetEase, picks the best
// match, and hands back the timed lyrics (LRC) with CORS allowed for the lyrics page.
//
// GET /api/lyrics?title=占有 - Live&artists=Zhou Shen|Joker Xue&duration=250
// -> { found: true, id, name, artists, duration, lrc }   or   { found: false }

import { pinyin } from 'pinyin-pro';
import { toSimp } from './_t2s.js';
import { TIMINGS } from './_timings.js';

const ALLOWED = ['https://alsonlim01.github.io', 'http://localhost:8000'];
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
  Referer: 'https://music.163.com/',
};

// Traditional characters become Simplified, so 小幸運 (Spotify) matches 小幸运 (NetEase).
const norm = s => toSimp(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const hasHan = s => /\p{Script=Han}/u.test(s || '');
// 周深 -> "zhoushen", so Spotify's romanised names match NetEase's Chinese ones.
const py = s => hasHan(s) ? norm(pinyin(s, { toneType: 'none', type: 'array' }).join('')) : norm(s);
// "占有 - Live", "占有（Live）", "Song (feat. X)", "Yellow - Remastered 2011" -> the plain title.
const cleanTitle = s => (s || '')
  .replace(/\s+-\s+.*$/, '')
  .replace(/\s*[(\[（【][^)\]）】]*[)\]）】]/g, '')
  .trim() || s;
const isLive = s => /\blive\b|现场|現場/i.test(s || '');
// Song credits NetEase puts at the top of its lyrics ("作词 : ...", "Composer: ...").
const CREDIT = /^\s*(作词|作曲|编曲|制作人|监制|和声|混音|母带|录音|吉他|贝斯|鼓|键盘|弦乐|出品|发行|词|曲|op|sp|lyrics?|composer|arranger|producer)\s*[:：]/i;

async function search(q, type) {
  const r = await fetch('https://music.163.com/api/cloudsearch/pc?' + new URLSearchParams({ s: q, type, limit: type === 100 ? 5 : 20 }), { headers: HEADERS });
  if (!r.ok) throw new Error('search ' + r.status);
  const j = await r.json();
  return (type === 100 ? j?.result?.artists : j?.result?.songs) || [];
}

// A song's timed lyrics (LRC) from NetEase, without the credit lines at the top.
async function lyricText(id) {
  const r = await fetch('https://music.163.com/api/song/lyric?' + new URLSearchParams({ id, lv: 1, tv: -1 }), { headers: HEADERS });
  if (!r.ok) throw new Error('lyric ' + r.status);
  const raw = (await r.json())?.lrc?.lyric || '';
  return raw.split('\n').filter(l => !CREDIT.test(l.replace(/\[[^\]]*\]/g, ''))).join('\n');
}

// Every name an artist goes by on NetEase, plus the pinyin of the Chinese ones.
const artistKeys = a => {
  const names = [a.name, ...(a.alias || []), ...(a.alia || []), ...(a.tns || []), ...(a.trans ? [a.trans] : [])].filter(Boolean);
  return [...new Set(names.flatMap(n => [norm(n), py(n)]).filter(k => k.length >= 2))];
};
const sameArtist = (keys, want) => keys.some(k => k === want || (k.length >= 4 && want.includes(k)) || (want.length >= 4 && k.includes(want)));

// Find the NetEase artist entries for the Spotify artist names (e.g. "Jay Chou" -> 周杰伦, id 6452).
async function resolveArtists(artists) {
  const found = await Promise.all(artists.slice(0, 3).map(async a => {
    if (hasHan(a)) return [];
    const want = norm(a);
    const list = await search(a, 100).catch(() => []);
    return list.filter(x => sameArtist(artistKeys(x), want));
  }));
  return found.flat();
}

function score(song, title, wantArtists, artistIds, duration) {
  const keys = song.ar.flatMap(artistKeys);
  const artistHit = song.ar.some(a => artistIds.has(a.id)) || wantArtists.some(w => sameArtist(keys, w));
  const want = norm(cleanTitle(title));
  const titles = [song.name, ...(song.tns || []), ...(song.alia || [])].map(t => norm(cleanTitle(t)));
  const titleHit = titles.includes(want) || titles.includes(py(cleanTitle(title)));
  const diff = Math.abs(song.dt / 1000 - duration);
  if (!titleHit || diff > 15) return null;
  // Without the right singer, only an almost exact length is trusted (covers share titles).
  if (!artistHit && diff > 2) return null;
  const cover = /cover|翻唱|翻自|女声版|男声版|原唱|伴奏|dj|remix/i.test(song.name);
  return (artistHit ? 100 : 0) + (isLive(title) === isLive(song.name) ? 15 : 0) - (cover ? 60 : 0) - diff * 2;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', ALLOWED.includes(origin) ? origin : ALLOWED[0]);
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const title = String(req.query.title || '').slice(0, 200);
  const artists = String(req.query.artists || '').split('|').map(s => s.trim()).filter(Boolean).slice(0, 6);
  const duration = Number(req.query.duration) || 0;
  if (!title || !duration) return res.status(400).json({ error: 'title and duration are required' });

  try {
    const plain = toSimp(cleanTitle(title));
    const resolved = await resolveArtists(artists);
    const artistIds = new Set(resolved.map(a => a.id));
    const wantArtists = artists.map(a => (hasHan(a) ? py(a) : norm(a)));
    // Search with the Chinese artist names where we know them, then the title alone.
    const queries = [...new Set([
      ...resolved.slice(0, 2).map(a => `${plain} ${a.name}`),
      ...artists.slice(0, 2).map(a => `${plain} ${a}`),
      plain,
    ])];
    const results = (await Promise.all(queries.map(q => search(q, 1).catch(() => [])))).flat();
    const seen = new Set();
    // Backing tracks (伴奏, instrumental) have no words: never use them.
    const INSTRUMENTAL = /伴奏|纯音乐|純音樂|instrumental|karaoke|off vocal|inst\.?\)/i;
    const unique = results.filter(s => !seen.has(s.id) && seen.add(s.id) && !INSTRUMENTAL.test(s.name));
    const ranked = unique
      .map(s => ({ s, sc: score(s, title, wantArtists, artistIds, duration) }))
      .filter(x => x.sc !== null)
      .sort((a, b) => b.sc - a.sc);

    // Live tracks are often covers sung on TV shows, filed on NetEase under the original singer only.
    // If the performers' own entries have no words, fall back to the same title by anyone (closest
    // length, covers and remixes last). The page treats these as "words from another recording".
    const want = norm(plain);
    const looseList = isLive(title) && want.length >= 2
      ? unique.filter(s => !ranked.some(x => x.s === s) && [s.name, ...(s.tns || []), ...(s.alia || [])].some(t => norm(cleanTitle(t)) === want))
        // The best-known version first (most likely the original words), then the closest length.
        .map(s => ({ s, sc: (s.pop || 0) - Math.min(Math.abs(s.dt / 1000 - duration), 60) * 0.5
          - (/cover|翻唱|翻自|dj|remix/i.test(s.name) ? 60 : 0) - (/ver\b|版/i.test(s.name) ? 15 : 0) }))
        .sort((a, b) => b.sc - a.sc)
      : [];

    // Recordings we've timed by hand (tools/align.mjs): NetEase's words with our line times.
    const timed = TIMINGS.find(x => x.title === want && Math.abs(x.duration - duration) <= 1.5
      && x.artists.some(a => wantArtists.some(w => w === a || w.includes(a) || a.includes(w))));
    if (timed) {
      // Words from NetEase, or from LRCLIB where only it has them (often untimed there).
      const text = timed.lrclibId
        ? await fetch('https://lrclib.net/api/get/' + timed.lrclibId).then(r => r.ok ? r.json() : {}).then(j => j.plainLyrics || j.syncedLyrics || '').catch(() => '')
        : await lyricText(timed.neteaseId).catch(() => '');
      const lines = text.split('\n').map(l => l.replace(/\[[^\]]*\]/g, '').trim()).filter(Boolean);
      if (lines.length === timed.lines) {
        const ts = t => `[${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}]`;
        const lrc = timed.sung.map(([li, t]) => ts(t) + lines[li]).join('\n');
        res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=86400');
        return res.status(200).json({ found: true, id: timed.neteaseId || 'lrclib' + timed.lrclibId, name: title, artists, duration, lrc, exact: true });
      }
    }

    const send = (s, lrc, loose) => {
      res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=86400');
      return res.status(200).json({ found: true, id: s.id, name: s.name, artists: s.ar.map(a => a.name), duration: s.dt / 1000, lrc, loose });
    };
    // Try the best few matches until one has timed lyrics.
    for (const { s } of ranked.slice(0, 3)) {
      const lrc = await lyricText(s.id).catch(() => '');
      if (/\[\d+:\d+/.test(lrc)) return send(s, lrc, false);
    }
    // Same title by other singers: many different songs share a title, so take the words that most
    // uploads agree on, and only if at least two of them do.
    const cands = (await Promise.all(looseList.slice(0, 6).map(async x => ({ s: x.s, lrc: await lyricText(x.s.id).catch(() => '') }))))
      .filter(c => /\[\d+:\d+/.test(c.lrc))
      .map(c => ({ ...c, chars: new Set([...toSimp(c.lrc.replace(/\[[^\]]*\]/g, ''))].filter(ch => /\p{L}/u.test(ch))) }));
    const alike = (a, b) => { let n = 0; for (const c of a.chars) if (b.chars.has(c)) n++; return n / Math.max(1, Math.min(a.chars.size, b.chars.size)); };
    // The singer's own studio version (just a different length from the live take) needs no vote.
    const own = cands.find(c => c.s.ar.some(a => artistIds.has(a.id)) || wantArtists.some(w => sameArtist(c.s.ar.flatMap(artistKeys), w)));
    if (own) return send(own.s, own.lrc, true);
    let pick = null, pickScore = 0;
    for (const c of cands) {
      const sims = cands.filter(o => o !== c).map(o => alike(c, o));
      // Uploads of the same song share ~40-65% of their characters, unrelated songs ~20%.
      const agree = sims.filter(v => v > 0.35).length, score = sims.filter(v => v > 0.35).reduce((a, b) => a + b, 0);
      if (agree >= 1 && score > pickScore) { pick = c; pickScore = score; }
    }
    if (pick) return send(pick.s, pick.lrc, true);
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    return res.status(200).json({ found: false });
  } catch (e) {
    return res.status(502).json({ error: 'NetEase could not be reached' });
  }
}
