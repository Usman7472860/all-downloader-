// Vercel serverless proxy: GET /api/dl?p=<provider>&url=<link>   |   GET /api/dl?list=1
// Keys can be overridden with env vars SANKA_KEY and KAYZU_KEY.
export const config = { maxDuration: 30 };
const SANKA = process.env.SANKA_KEY || 'planaai';
const KAYZU = process.env.KAYZU_KEY || 'kayzuMD';
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
const clean = (u) => (typeof u === 'string' ? u.replace(/\\\//g, '/').replace(/&amp;/g, '&').trim() : u);
const L = (label, url, type) => (url ? { label, url: clean(url), type } : null);
const out = (title, thumb, links) => ({ title: title || '', thumb: thumb || '', links: links.filter(Boolean) });

// Fallback: collect every URL found in an unknown JSON shape, with quality info from sibling fields.
const QK = /^(quality|resolution|res|label|format|height|definition|qualityLabel|text|name|size_label)$/i;
const heightOf = (str) => { const m = String(str || '').match(/(\d{3,4})\s*p\b|\b(\d{3,4})x(\d{3,4})|(?:^|[^\d])(2160|1440|1080|720|480|360|240|144)(?!\d)/i); return m ? +(m[1] || m[3] || m[4]) : 0; };
function sweep(json) {
  const found = [];
  (function walk(v, k, parent) {
    if (typeof v === 'string' && /^https?:\/\//.test(v)) {
      let ctx = '';
      if (parent && !Array.isArray(parent)) for (const [pk, pv] of Object.entries(parent)) if (QK.test(pk) && (typeof pv === 'string' || typeof pv === 'number')) ctx += ' ' + pv;
      found.push([k || 'link', v, ctx.trim()]);
    } else if (v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) walk(vv, Array.isArray(v) ? k : kk, v);
  })(json);
  const type = (u, k) => (/\.(mp3|m4a|opus|aac|wav)|audio|music|mp3/i.test(u + ' ' + k) ? 'audio' : /\.(jpe?g|png|webp)|image|photo/i.test(u) ? 'image' : 'video');
  return out(json?.title || json?.result?.title || json?.data?.title, '', found.map(([k, u, ctx]) => {
    const t = type(u, k), h = heightOf(ctx) || heightOf(k) || heightOf(u);
    const label = h ? h + 'p' : (ctx && ctx.length < 18 ? ctx : k);
    return L(label, u, t);
  }));
}

// Result ko saaf karo: label normalize (1080p / HD / SD), duplicate hatao, badi quality pehle.
const rank = (l) => { if (l.type === 'audio') return -1; const h = heightOf(l.label); if (h) return h; if (/^hd|best|high/i.test(l.label)) return 720; if (/^sd|low/i.test(l.label)) return 360; return 1; };
function polish(r) {
  const seen = new Set();
  r.links = r.links.filter((l) => !seen.has(l.url) && seen.add(l.url)).map((l) => {
    const h = heightOf(l.label);
    return { ...l, label: h && /^\d{3,4}$/.test(l.label.trim()) ? h + 'p' : l.label };
  });
  r.links = r.links.map((l, i) => ({ l, i })).sort((a, b) => rank(b.l) - rank(a.l) || a.i - b.i).map((x) => x.l);
  return r;
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
  'fb-scrape': { name: 'Facebook (direct scrape)', plat: 'facebook', run: async (u) => {
    const unesc = (x) => { try { return JSON.parse('"' + x + '"'); } catch { return x.replace(/\\\//g, '/').replace(/\\u0025/g, '%').replace(/\\u0026/g, '&'); } };
    const pick = (h, k) => { const m = h.match(new RegExp('"' + k + '":"([^"]+)"')); return m ? unesc(m[1]) : null; };
    const og = (h, k) => { const m = h.match(new RegExp('<meta[^>]+property="' + k + '"[^>]+content="([^"]+)"', 'i')) || h.match(new RegExp('<meta[^>]+content="([^"]+)"[^>]+property="' + k + '"', 'i')); return m ? clean(m[1]) : null; };
    const BOT = { 'user-agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uagent.php)', 'accept-language': 'en-US,en;q=0.9' };
    if (/fb\.watch|\/share\//.test(u)) { try { u = (await fetch(u, { redirect: 'follow', headers: BOT })).url || u; } catch {} }
    const tries = [
      [`https://www.facebook.com/plugins/video.php?href=${q(u)}&show_text=0`, { ...UA, 'accept-language': 'en-US,en;q=0.9' }],
      [u, BOT],
      [u.replace('www.facebook.com', 'm.facebook.com'), { 'user-agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' }],
      [u, { ...UA, 'accept-language': 'en-US,en;q=0.9' }],
    ];
    for (const [pg, headers] of tries) {
      try {
        const h = await (await fetch(pg, { redirect: 'follow', headers })).text();
        const hd = pick(h, 'browser_native_hd_url') || pick(h, 'playable_url_quality_hd') || pick(h, 'hd_src');
        const sd = pick(h, 'browser_native_sd_url') || pick(h, 'playable_url') || pick(h, 'sd_src') || og(h, 'og:video:secure_url') || og(h, 'og:video:url') || og(h, 'og:video');
        if (hd || sd) return out(og(h, 'og:title') || 'Facebook video', og(h, 'og:image'), [L('HD', hd, 'video'), L('SD', sd, 'video')]);
      } catch {}
    }
    throw 'scrape blocked';
  } },
  'fb-davidcyril': { name: 'Facebook (DavidCyril)', plat: 'facebook', run: async (u) => {
    const j = await get(`https://apis.davidcyriltech.my.id/facebook2?url=${q(u)}`);
    const v = j?.video; if (!j.status || !v?.downloads?.length) throw 'no video';
    return out(v.title, v.thumbnail, v.downloads.map((d) => L(d.quality || 'Video', d.downloadUrl, 'video')));
  } },
  'fb-agatz': { name: 'Facebook (Agatz)', plat: 'facebook', run: async (u) => sweep(await get(`https://api.agatz.xyz/api/facebook?url=${q(u)}`)) },
  'fb-dorratz': { name: 'Facebook (Dorratz)', plat: 'facebook', run: async (u) => sweep(await get(`https://api.dorratz.com/fbvideo?url=${q(u)}`)) },
  'fb-fdownloader': { name: 'Facebook (FDownloader)', plat: 'facebook', run: async (u) => {
    const H = { ...UA, 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 'x-requested-with': 'XMLHttpRequest' };
    const v = await (await fetch('https://fdownloader.net/api/userverify', { method: 'POST', headers: H, body: `url=${q(u)}` })).json();
    if (!v.success || !v.token) throw 'verify failed';
    const body = `k_exp=${Math.floor(Date.now() / 1000) + 300}&k_token=${v.token.split('.')[2]}&q=${q(u)}&lang=en&web=fdownloader.net&v=v2&w=&cftoken=${v.token}`;
    const j = await (await fetch('https://v3.fdownloader.net/api/ajaxSearch', { method: 'POST', headers: H, body })).json();
    const html = String(j.data || '');
    const links = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => clean(m[1])).filter((x) => /fbcdn|\.mp4|download/i.test(x) && !/fdownloader\.net\/?$/.test(x));
    return out(html.match(/<h3[^>]*>([^<]+)</)?.[1] || 'Facebook video', html.match(/<img[^>]+src="([^"]+)"/)?.[1], links.map((x, i) => L(i === 0 ? 'Best' : 'Option ' + (i + 1), x, 'video')));
  } },
  'fdown-isuru': { name: 'Facebook (fdown.isuru)', plat: 'facebook', run: async (u) => {
    const r = await fetch('https://fdown.isuru.eu.org/info', { method: 'POST', headers: { ...UA, 'content-type': 'application/json' }, body: JSON.stringify({ url: u }) });
    return sweep(await r.json());
  } },
  'fdown-facebook': { name: 'Facebook (FDown)', plat: 'facebook', run: async (u) => {
    const r = await fetch('https://fdown.net/download.php', { method: 'POST', headers: { ...UA, 'content-type': 'application/x-www-form-urlencoded', origin: 'https://fdown.net', referer: 'https://fdown.net/' }, body: new URLSearchParams({ URLz: u }) });
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


// ---- Extra Facebook providers (generic JSON; filtered so thumbnails/echoed page links never count as a result) ----
const fbSweep = (json) => {
  const s = sweep(json), seen = new Set();
  s.links = s.links.filter((l) => l.type !== 'image' && !/thumb|cover|image|poster|avatar|profile|preview/i.test(l.label)
    && !/^https?:\/\/(www\.|m\.|web\.)?(facebook\.com|fb\.watch)\//.test(l.url) && !seen.has(l.url) && seen.add(l.url));
  if (!s.links.length) throw 'no video links';
  return s;
};
[
  ['fb-azbry', 'Facebook (Azbry)', 'https://api.azbry.com/api/download/facebook?url={u}'],
  ['fb-yupra', 'Facebook (Yupra)', 'https://api.yupra.my.id/api/downloader/facebook?url={u}'],
  ['fb-mif', 'Facebook (Mifinfinity)', 'https://api.mifinfinity.my.id/api/downloader/facebook?url={u}'],
  ['fb-nexray', 'Facebook (Nexray)', 'https://api.nexray.eu.cc/downloader/facebook?url={u}'],
  ['fb-siputzx', 'Facebook (Siputzx)', 'https://api.siputzx.my.id/api/d/facebook?url={u}'],
  ['fb-vreden', 'Facebook (Vreden)', 'https://api.vreden.my.id/api/fbdl?url={u}'],
  ['fb-vreden2', 'Facebook (Vreden v1)', 'https://api.vreden.my.id/api/v1/download/facebook?url={u}'],
  ['fb-ryzumi', 'Facebook (Ryzumi)', 'https://api.ryzumi.vip/api/downloader/fbdl?url={u}'],
  ['fb-nekolabs', 'Facebook (Nekolabs)', 'https://api.nekolabs.my.id/downloader/facebook?url={u}'],
  ['fb-akuari', 'Facebook (Akuari)', 'https://api.akuari.my.id/downloader/fbdl?link={u}'],
  ['fb-diioffc', 'Facebook (Diioffc)', 'https://api.diioffc.web.id/api/download/facebook?url={u}'],
  ['fb-simplebot', 'Facebook (Simplebot)', 'https://restapi-v2.simplebot.my.id/download/facebook?url={u}'],
  ['fb-nexadev', 'Facebook (Nexadev)', 'https://api.nexadev.my.id/api/downloader/facebook?url={u}'],
  ['fb-synox', 'Facebook (Synoxcloud)', 'https://api.synoxcloud.xyz/downloader/facebook?url={u}'],
].forEach(([id, name, tpl]) => { P[id] = { name, plat: 'facebook', run: async (u) => fbSweep(await get(tpl.replace('{u}', q(u)))) }; });

P['fb-getfvid'] = { name: 'Facebook (GetFVid)', plat: 'facebook', run: async (u) => {
  const r = await fetch('https://getfvid.com/downloader', { method: 'POST', headers: { ...UA, 'content-type': 'application/x-www-form-urlencoded', origin: 'https://getfvid.com', referer: 'https://getfvid.com/' }, body: new URLSearchParams({ url: u }) });
  const h = await r.text();
  const links = [...h.matchAll(/href="(https?:\/\/[^"]+)"[^>]*(?:download|btn)/gi)].map((m) => clean(m[1])).filter((x) => !/getfvid\.com/.test(x));
  if (!links.length) throw 'no links';
  return out(h.match(/<title>([^<]+)/)?.[1] || 'Facebook video', '', links.map((x, i) => L('Link ' + (i + 1), x, 'video')));
} };

// ---- Universal providers (v1, v2): kisi bhi platform ke link par chalte hain (plat: 'any') ----
const uSweep = (json, src) => {
  const s = sweep(json), seen = new Set();
  s.links = s.links.filter((l) => l.type !== 'image' && !/thumb|cover|poster|avatar|profile|preview/i.test(l.label)
    && l.url !== src && !seen.has(l.url) && seen.add(l.url));
  if (!s.links.length) throw 'no links';
  s.title = s.title || json?.data?.title || json?.result?.title || '';
  return s;
};
P['all-v1'] = { name: 'All Downloader API v1', plat: 'any', run: async (u) =>
  uSweep(await get(`https://fak-media-downloaders.jokerkeep057.workers.dev/dl/?url=${q(u)}`), u) };
P['all-v2'] = { name: 'All Downloader API v2', plat: 'any', run: async (u) =>
  uSweep(await get(`https://multidownapi.vercel.app/?url=${q(u)}`), u) };

// platform ke liye providers: universal v1/v2 pehle, phir platform wale
const idsFor = (plat) => Object.keys(P)
  .filter((k) => P[k].plat === plat || (P[k].plat === 'any' && plat !== 'search'))
  .sort((a, b) => (P[b].plat === 'any') - (P[a].plat === 'any'));

const detect = (u) =>
  /tiktok\.com/.test(u) ? 'tiktok' : /instagram\.com/.test(u) ? 'instagram' : /pinterest\.|pin\.it/.test(u) ? 'pinterest'
  : /soundcloud\.com/.test(u) ? 'soundcloud' : /youtu\.?be/.test(u) ? 'youtube' : /facebook\.com|fb\.watch/.test(u) ? 'facebook'
  : /capcut\.com/.test(u) ? 'capcut' : 'search';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { p, url, list, order } = req.query;
  if (list) return res.json(Object.entries(P).map(([id, v]) => ({ id, name: v.name, plat: v.plat })));
  if (!url) return res.status(400).json({ ok: false, error: 'url missing' });
  const plat = detect(url);
  if (order) return res.json({ platform: plat, ids: idsFor(plat).map((id) => ({ id, name: P[id].name })) });
  const ids = p && P[p] ? [p] : idsFor(plat);
  const errors = [];
  // run all providers for this platform in parallel; first one with links wins (avoids Vercel function timeout)
  const jobs = ids.map((id) =>
    Promise.race([P[id].run(url), new Promise((_, rej) => setTimeout(() => rej('timeout'), 15000))])
      .then((r) => { if (!r.links.length) throw 'no links'; return { id, r }; })
      .catch((e) => { errors.push(id + ': ' + (e?.message || e || 'failed')); throw e; }));
  try {
    const { id, r } = await Promise.any(jobs);
    return res.json({ ok: true, provider: P[id].name, platform: plat, ...polish(r) });
  } catch {
    return res.status(502).json({ ok: false, error: 'Sab APIs fail ho gayi ya link galat hai', tried: errors });
  }
}
