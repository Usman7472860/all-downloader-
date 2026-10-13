// Vercel serverless proxy: GET /api/dl?p=<provider>&url=<link>   |   GET /api/dl?list=1
// Keys can be overridden with env vars SANKA_KEY and KAYZU_KEY.
const SANKA = process.env.SANKA_KEY || 'planaai';
const KAYZU = process.env.KAYZU_KEY || 'kayzuMD';
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
const clean = (u) => (typeof u === 'string' ? u.replace(/\\\//g, '/').replace(/&amp;/g, '&').trim() : u);
const L = (label, url, type) => (url ? { label, url: clean(url), type } : null);
const out = (title, thumb, links) => ({ title: title || '', thumb: thumb || '', links: links.filter(Boolean) });

// Fallback: collect every URL found in an unknown JSON shape.
function sweep(json) {
  const found = [];
  (function walk(v, k) {
    if (typeof v === 'string' && /^https?:\/\//.test(v)) found.push([k || 'link', v]);
    else if (v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) walk(vv, kk);
  })(json);
  const type = (u) => (/\.(mp3|m4a|opus)|audio/i.test(u) ? 'audio' : /\.(jpe?g|png|webp)/i.test(u) ? 'image' : 'video');
  return out(json?.title || json?.result?.title, '', found.map(([k, u]) => L(k, u, type(u))));
}

const get = async (u, o) => (await fetch(u, { headers: UA, ...o })).json();
const q = encodeURIComponent;

const P = {
  'azbry-tiktok': { name: 'TikTok (Azbry)', plat: 'tiktok', run: async (u) => {
    const j = await get(`https://api.azbry.com/api/download/tiktok?url=${q(u)}`);
    if (!j.status) throw 0;
    return out(j.result.title, j.result.cover, [L('Video', j.result.links?.[0], 'video'), L('Music', j.result.music?.url, 'audio')]);
  } },
  'yupra-tiktok': { name: 'TikTok HD (Yupra)', plat: 'tiktok', run: async (u) => {
    const j = await get(`https://api.yupra.my.id/api/downloader/tiktok?url=${q(u)}`);
    if (j.status !== 200 || !j.result?.data) throw 0;
    return out(j.result.title, '', j.result.data.map((d) => L(d.type, d.url, 'video')));
  } },
  'tikwm': { name: 'TikTok (TikWM)', plat: 'tiktok', run: async (u) => {
    const j = await get(`https://www.tikwm.com/api/?url=${q(u)}&hd=1`);
    if (j.code !== 0) throw 0;
    const d = j.data, f = (x) => (x && x.startsWith('/') ? 'https://www.tikwm.com' + x : x);
    return out(d.title, f(d.cover), [L('HD', f(d.hdplay), 'video'), L('No watermark', f(d.play), 'video'), L('Music', f(d.music), 'audio')]);
  } },
  'azbry-instagram': { name: 'Instagram (Azbry)', plat: 'instagram', run: async (u) => {
    const j = await get(`https://api.azbry.com/api/download/instagram?url=${q(u)}`);
    if (!j.status) throw 0;
    return out('Instagram ' + (j.type || ''), j.thumb, [
      ...(j.videos || []).map((v, i) => L('Video ' + (i + 1), v, 'video')),
      ...(j.images || []).map((v, i) => L('Photo ' + (i + 1), v, 'image'))]);
  } },
  'azbry-pinterest': { name: 'Pinterest (Azbry)', plat: 'pinterest', run: async (u) => {
    const j = await get(`https://api.azbry.com/api/download/pinterest?url=${q(u)}`);
    if (!j.status || !j.result) throw 0;
    const s = sweep(j.result); s.title = j.result.title || s.title; return s;
  } },
  'azbry-soundcloud': { name: 'SoundCloud (Azbry)', plat: 'soundcloud', run: async (u) => {
    const j = await get(`https://api.azbry.com/api/download/soundcloud?url=${q(u)}`);
    if (!j.status) throw 0;
    return out(j.result.title, j.result.thumbnail, [L('MP3', j.result.download, 'audio')]);
  } },
  'sanka-yt-mp3': { name: 'YouTube MP3 (Sanka)', plat: 'youtube', run: async (u) => {
    const j = await get(`https://www.sankavollerei.com/download/ytmp3?apikey=${q(SANKA)}&url=${q(u)}`);
    if (!j.status) throw 0;
    return out(j.result.title, j.result.thumbnail, [L('MP3', j.result.download, 'audio')]);
  } },
  'mif-yt-audio': { name: 'YouTube Audio (Mifinfinity)', plat: 'youtube', run: async (u) => {
    const j = await get(`https://api.mifinfinity.my.id/api/downloader/youtube?url=${q(u)}&type=audio`);
    if (!j.status || !j.result?.download) throw 0;
    return out(j.result.title, j.result.thumbnail, [L('MP3', j.result.download, 'audio')]);
  } },
  'mif-yt-video': { name: 'YouTube Video (Mifinfinity)', plat: 'youtube', run: async (u) => {
    const j = await get(`https://api.mifinfinity.my.id/api/downloader/youtube?url=${q(u)}&type=video`);
    if (!j.status || !j.result?.download) throw 0;
    return out(j.result.title, j.result.thumbnail, [L('MP4', j.result.download, 'video')]);
  } },
  'akuari-youtube': { name: 'YouTube (Akuari)', plat: 'youtube', run: async (u) => sweep(await get(`https://api.akuari.my.id/downloader/youtube?link=${q(u)}`)) },
  'fdown-facebook': { name: 'Facebook (FDown)', plat: 'facebook', run: async (u) => {
    const r = await fetch('https://fdown.net/download.php', { method: 'POST', headers: { ...UA, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ URLz: u }) });
    const h = await r.text();
    const hd = h.match(/id="hdlink" href="(.+?)" download/)?.[1], sd = h.match(/id="sdlink" href="(.+?)" download/)?.[1];
    if (!hd && !sd) throw 0;
    return out('Facebook video', '', [L('HD', hd, 'video'), L('SD', sd, 'video')]);
  } },
  '3bic-capcut': { name: 'CapCut (3bic)', plat: 'capcut', run: async (u) => {
    const r = await fetch('https://3bic.com/api/download', { method: 'POST', headers: { ...UA, 'content-type': 'application/json' }, body: JSON.stringify({ url: u }) });
    const j = await r.json();
    const b = j?.originalVideoUrl?.split('/api/cdn/')[1];
    if (!b) throw 0;
    return out(j.title, '', [L('Video', Buffer.from(b, 'base64').toString(), 'video')]);
  } },
  'alvian-play': { name: 'YouTube search to MP3 (Alvianuxio)', plat: 'search', run: async (u) => {
    const j = await get(`https://api.alvianuxio.eu.org/api/play?query=${q(u)}&apikey=${q(KAYZU)}&format=mp3`);
    const s = j?.data?.response; if (!s?.download) throw 0;
    return out(s.title, '', [L('MP3', s.download, 'audio')]);
  } },
  'nexray-spotify': { name: 'Spotify search (Nexray)', plat: 'search', run: async (u) => {
    const j = await get(`https://api.nexray.eu.cc/downloader/spotifyplay?q=${q(u)}`);
    if (!j.status || !j.result) throw 0;
    return out(`${j.result.title} - ${j.result.artist}`, j.result.thumbnail, [L('MP3', j.result.download_url, 'audio')]);
  } },
};

const detect = (u) =>
  /tiktok\.com/.test(u) ? 'tiktok' : /instagram\.com/.test(u) ? 'instagram' : /pinterest\.|pin\.it/.test(u) ? 'pinterest'
  : /soundcloud\.com/.test(u) ? 'soundcloud' : /youtu\.?be/.test(u) ? 'youtube' : /facebook\.com|fb\.watch/.test(u) ? 'facebook'
  : /capcut\.com/.test(u) ? 'capcut' : 'search';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { p, url, list } = req.query;
  if (list) return res.json(Object.entries(P).map(([id, v]) => ({ id, name: v.name, plat: v.plat })));
  if (!url) return res.status(400).json({ ok: false, error: 'url missing' });
  const plat = detect(url);
  const ids = p && P[p] ? [p] : Object.keys(P).filter((k) => P[k].plat === plat);
  const errors = [];
  for (const id of ids) {   // auto fallback: next provider if one fails
    try {
      const r = await Promise.race([P[id].run(url), new Promise((_, rej) => setTimeout(() => rej('timeout'), 20000))]);
      if (r.links.length) return res.json({ ok: true, provider: P[id].name, platform: plat, ...r });
      errors.push(id + ': no links');
    } catch (e) { errors.push(id + ': failed'); }
  }
  res.status(502).json({ ok: false, error: 'Sab APIs fail ho gayi ya link galat hai', tried: errors });
}
