// GET /api/get?url=<media>&name=<filename>  -> streams the file as an attachment so the browser downloads it directly.
import { Readable } from 'node:stream';
export const config = { maxDuration: 60 };
export default async function handler(req, res) {
  const { url, name } = req.query;
  let u;
  try { u = new URL(url); } catch { return res.status(400).end('bad url'); }
  if (!/^https?:$/.test(u.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[)/i.test(u.hostname))
    return res.status(400).end('blocked');
  try {
    const r = await fetch(u, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', referer: u.origin + '/' } });
    if (!r.ok || !r.body) return res.status(502).end('upstream ' + r.status);
    const fn = String(name || 'download').replace(/[^\w.\- ]+/g, '_').trim().slice(0, 80) || 'download';
    res.setHeader('Content-Type', r.headers.get('content-type') || 'application/octet-stream');
    const len = r.headers.get('content-length');
    if (len) res.setHeader('Content-Length', len);
    res.setHeader('Content-Disposition', `attachment; filename="${fn}"`);
    Readable.fromWeb(r.body).pipe(res);
  } catch (e) { res.status(502).end('fetch failed'); }
}
