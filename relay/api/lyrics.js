// Chinese-lyrics relay for the Tesla lyrics page.
// NetEase Cloud Music has far better coverage of Chinese songs than LRCLIB, but it doesn't let web
// pages read its data directly (no CORS). This function looks the song up on NetEase, picks the best
// match, and hands back the timed lyrics (LRC) with CORS allowed for the lyrics page.
//
// GET /api/lyrics?title=占有 - Live&artists=Zhou Shen|Joker Xue&duration=250
// -> { found: true, id, name, artists, duration, lrc }   or   { found: false }

import { pinyin } from 'pinyin-pro';

const ALLOWED = ['https://alsonlim01.github.io', 'http://localhost:8000'];
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
  Referer: 'https://music.163.com/',
};

const norm = s => (s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
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
    const plain = cleanTitle(title);
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
    const ranked = results
      .filter(s => !seen.has(s.id) && seen.add(s.id))
      .map(s => ({ s, sc: score(s, title, wantArtists, artistIds, duration) }))
      .filter(x => x.sc !== null)
      .sort((a, b) => b.sc - a.sc);

    // Try the best few matches until one has timed lyrics.
    for (const { s } of ranked.slice(0, 3)) {
      const r = await fetch('https://music.163.com/api/song/lyric?' + new URLSearchParams({ id: s.id, lv: 1, tv: -1 }), { headers: HEADERS });
      if (!r.ok) continue;
      const j = await r.json();
      const raw = j?.lrc?.lyric || '';
      if (!/\[\d+:\d+/.test(raw)) continue;
      const lrc = raw.split('\n').filter(l => !CREDIT.test(l.replace(/\[[^\]]*\]/g, ''))).join('\n');
      res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=86400');
      return res.status(200).json({ found: true, id: s.id, name: s.name, artists: s.ar.map(a => a.name), duration: s.dt / 1000, lrc });
    }
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    return res.status(200).json({ found: false });
  } catch (e) {
    return res.status(502).json({ error: 'NetEase could not be reached' });
  }
}
