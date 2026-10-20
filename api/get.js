// GET /api/get?url=<media>&name=<filename>  -> streams the file as an attachment so the browser downloads it directly.
import { Readable } from 'node:stream';
export const config = { maxDuration: 60 };
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
export default async function handler(req, res) {
  const { url, name } = req.query;
  let u;
  try { u = new URL(url); } catch { return res.status(400).end('bad url'); }
  if (!/^https?:$/.test(u.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[)/i.test(u.hostname))
    return res.status(400).end('blocked');
  const go = (ref) => fetch(u, { redirect: 'follow', headers: { 'user-agent': UA, accept: '*/*', ...(ref ? { referer: u.origin + '/' } : {}) } });
  try {
    let r = await go(true);
    if ([400, 401, 403].includes(r.status)) r = await go(false); // kuch CDN referer par block karte hain
    if (!r.ok || !r.body) return res.status(502).end('upstream ' + r.status);
    const ct = r.headers.get('content-type') || 'application/octet-stream';
    if (/text\/html|application\/json/i.test(ct)) return res.status(502).end('link expire ya block hai');
    const fn = String(name || 'download').replace(/[^\w.\- ]+/g, '_').trim().slice(0, 80) || 'download';
    res.setHeader('Content-Type', ct);
    const len = r.headers.get('content-length');
    if (len && !r.headers.get('content-encoding')) res.setHeader('Content-Length', len); // gzip ho to length galat ho jati hai
    res.setHeader('Content-Disposition', `attachment; filename="${fn}"`);
    res.setHeader('Cache-Control', 'no-store');
    const s = Readable.fromWeb(r.body);
    s.on('error', () => res.destroy());
    req.on('close', () => s.destroy());
    s.pipe(res);
  } catch (e) { if (!res.headersSent) res.status(502).end('fetch failed'); else res.destroy(); }
}
