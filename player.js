// Library (IndexedDB) + video/audio player + image viewer. Plain JS, no dependencies.
(() => {
const $ = (s) => document.querySelector(s);
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const PATH = {
  play: '<path d="M8 5v14l11-7z"/>', pause: '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>',
  vol: '<path d="M4 9v6h4l5 4V5L8 9H4zm12 3a4 4 0 0 0-2-3.5v7A4 4 0 0 0 16 12z"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9l5 6m0-6l-5 6" stroke="currentColor" stroke-width="2" fill="none"/>',
  fs: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2"/>',
  pip: '<path d="M3 5h18v14H3zM12 11h8v6h-8z" fill="none" stroke="currentColor" stroke-width="2"/>',
  loop: '<path d="M4 12a5 5 0 0 1 5-5h9l-3-3m3 3l-3 3M20 12a5 5 0 0 1-5 5H6l3 3m-3-3l3-3" fill="none" stroke="currentColor" stroke-width="2"/>',
  note: '<path d="M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zm11-2a3 3 0 1 1-3-3 3 3 0 0 1 3 3z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  save: '<path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 20h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  img: '<path d="M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6" fill="none" stroke="currentColor" stroke-width="1.8"/>',
};
const ic = (n, s = 22) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="currentColor">${PATH[n]}</svg>`;
const fmt = (t) => { if (!isFinite(t)) return '0:00'; t = Math.floor(t); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
const mb = (b) => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const MIME = { video: 'video/mp4', audio: 'audio/mpeg', image: 'image/jpeg' }, EXT = { video: 'mp4', audio: 'mp3', image: 'jpg' };
const MAX = 120 * 1048576;

// ---------- storage ----------
const idb = new Promise((res, rej) => { const r = indexedDB.open('dl-lib', 1); r.onupgradeneeded = () => r.result.createObjectStore('items', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const tx = async (mode, fn) => { const db = await idb; return new Promise((res, rej) => { const t = db.transaction('items', mode), r = fn(t.objectStore('items')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };
let items = [], filter = 'all';
const urlOf = (i) => i.blob ? (i._u || (i._u = URL.createObjectURL(i.blob))) : i.src;

function saveBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
function direct(src, name) { const a = document.createElement('a'); a.href = src; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }

// ---------- notifications (progress + done) ----------
const NICON = '/icons/icon-192.png';
const fmtT = (sec) => !isFinite(sec) || sec < 0 ? '--' : sec < 60 ? Math.max(1, Math.round(sec)) + ' sec' : Math.floor(sec / 60) + ' min ' + String(Math.round(sec % 60)).padStart(2, '0') + ' sec';
async function notify(tag, title, body, o = {}) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const opt = { body, tag, icon: NICON, badge: NICON, renotify: false, silent: true, ...o };
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready : null;
    if (reg && reg.showNotification) await reg.showNotification(title, opt); else new Notification(title, opt);
  } catch {}
}
function askNotify() { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch {} }
window.askNotify = askNotify;

// WhatsApp status / local file ko library me daalo aur device me save karo
async function addFile(file, type) {
  const name = file.name || ('status-' + Date.now() + (type === 'video' ? '.mp4' : '.jpg'));
  const blob = file.slice(0, file.size, file.type || MIME[type] || 'application/octet-stream');
  saveBlob(blob, name);
  await add({ id: Date.now() + Math.random().toString(36).slice(2, 6), title: 'WhatsApp status', type, label: 'Status', thumb: '', src: '', blob, size: blob.size, ts: Date.now(), name });
  notify('dl-' + name, '\u2705 Downloaded by US MODS', 'WhatsApp status\nSize ' + mb(blob.size), { silent: false, renotify: true, vibrate: [120, 60, 120] });
  window.toast && toast('Downloaded by US MODS');
}
async function download(l, title, thumb, btn) {
  const name = ((title || 'download').replace(/[^\w\- ]+/g, '').trim().slice(0, 50) || 'download') + '-' + l.label.replace(/[^\w]+/g, '') + '.' + (EXT[l.type] || 'mp4');
  const src = '/api/get?url=' + encodeURIComponent(l.url) + '&name=' + encodeURIComponent(name);
  const sm = btn.querySelector('small'); btn.disabled = true; sm.textContent = 'Connecting...';
  const tag = 'dl-' + name, t0 = Date.now(), short = (title || name).slice(0, 60);
  askNotify(); notify(tag, 'US MODS: download shuru', short + '\nConnecting...');
  const mk = (blob) => ({ id: Date.now() + Math.random().toString(36).slice(2, 6), title: title || name, type: l.type, label: l.label, thumb: thumb || '', src, blob: blob || null, size: blob ? blob.size : 0, ts: Date.now(), name });
  try {
    const r = await fetch(src);
    if (!r.ok || !r.body) throw new Error('server ' + r.status);
    const len = +r.headers.get('content-length') || 0;
    if (len > MAX) { direct(src, name); await add(mk(null)); notify(tag, '\u2705 Downloaded by US MODS', short + '\nBadi file: browser download manager me chal rahi hai', { silent: false, renotify: true }); finish(btn, 'Large file: direct download started'); return; }
    const rd = r.body.getReader(), parts = []; let got = 0;
    let lastN = 0, lastB = 0, lastT = t0, speed = 0;
    for (;;) {
      const { done, value } = await rd.read(); if (done) break;
      parts.push(value); got += value.length;
      btn.style.setProperty('--p', len ? got / len : 0);
      const now = Date.now();
      if (now - lastT >= 700) { const inst = (got - lastB) / ((now - lastT) / 1000); speed = speed ? speed * 0.6 + inst * 0.4 : inst; lastB = got; lastT = now; }
      const pct = len ? Math.round(got / len * 100) : 0, eta = len && speed ? (len - got) / speed : NaN;
      const spd = speed ? mb(speed) + '/s' : '...';
      sm.textContent = len ? `Downloading ${pct}% - ${spd}${isFinite(eta) ? ' - ' + fmtT(eta) + ' baqi' : ''}` : `Downloading ${mb(got)} - ${spd}`;
      if (now - lastN >= 1000) {
        lastN = now;
        const bar = len ? '\u2593'.repeat(Math.round(pct / 10)) + '\u2591'.repeat(10 - Math.round(pct / 10)) + ' ' + pct + '%' : mb(got);
        notify(tag, `US MODS: downloading${len ? ' ' + pct + '%' : ''}`,
          `${short}\n${bar}\n${mb(got)}${len ? ' / ' + mb(len) : ''}  |  Speed ${spd}\n${len && isFinite(eta) ? 'Baqi: ' + fmtT(eta) : 'Time check ho raha hai...'}`);
      }
    }
    let ct = r.headers.get('content-type') || ''; if (!/^(video|audio|image)\//.test(ct)) ct = MIME[l.type] || 'application/octet-stream';
    const blob = new Blob(parts, { type: ct });
    saveBlob(blob, name);
    await add(mk(blob));
    const took = (Date.now() - t0) / 1000;
    notify(tag, '\u2705 Downloaded by US MODS', `${short}\nSize ${mb(blob.size)}  |  Time ${fmtT(took)}`, { silent: false, renotify: true, vibrate: [120, 60, 120] });
    finish(btn, 'Downloaded by US MODS - library me save hai');
  } catch (e) { btn.disabled = false; btn.style.removeProperty('--p'); sm.textContent = 'Tap to retry'; window.toast && toast('Download fail: ' + e.message); notify(tag, '\u274C US MODS: download fail', short + '\n' + e.message, { silent: false, renotify: true }); }
}
function finish(btn, msg) { btn.disabled = false; btn.classList.add('done'); btn.style.setProperty('--p', 1); btn.querySelector('small').textContent = msg; window.toast && toast('Downloaded by US MODS'); }
async function add(it) { try { await tx('readwrite', (s) => s.put(it)); } catch { it.blob = null; } items.unshift(it); render(); }
async function remove(id) { const i = items.find((x) => x.id === id); if (i && i._u) URL.revokeObjectURL(i._u); items = items.filter((x) => x.id !== id); try { await tx('readwrite', (s) => s.delete(id)); } catch {} render(); }

// ---------- library UI ----------
function render() {
  const lib = $('#lib'); lib.hidden = !items.length; const cd = document.getElementById('cDl'); if (cd) cd.textContent = items.length; const de = document.getElementById('dlEmpty'); if (de) de.hidden = !!items.length; if (!items.length) return;
  const cnt = (t) => t === 'all' ? items.length : items.filter((i) => i.type === t).length;
  const tabs = $('#tabs'); tabs.innerHTML = '';
  [['all', 'All'], ['video', 'Video'], ['audio', 'Audio'], ['image', 'Images']].forEach(([k, n]) => { if (k !== 'all' && !cnt(k)) return; const b = el('button', k === filter ? 'on' : '', `${n} ${cnt(k)}`); b.onclick = () => { filter = k; render(); }; tabs.append(b); });
  const clr = el('button', 'clr', 'Clear all'); clr.onclick = async () => { if (!confirm('Poori library delete karni hai?')) return; for (const i of [...items]) await remove(i.id); }; tabs.append(clr);
  const list = items.filter((i) => filter === 'all' || i.type === filter), g = $('#lgrid'); g.innerHTML = '';
  list.forEach((it, n) => {
    const c = el('div', 'card'), th = el('button', 'th'); th.setAttribute('aria-label', 'Open ' + it.title);
    const pic = it.type === 'image' ? urlOf(it) : it.thumb;
    th.innerHTML = ic(it.type === 'audio' ? 'note' : it.type === 'image' ? 'img' : 'play', 34);
    if (pic) { const im = el('img'); im.src = pic; im.loading = 'lazy'; im.referrerPolicy = 'no-referrer'; im.onerror = () => im.remove(); th.append(im); }
    th.append(el('span', 'ty', it.type)); if (it.type !== 'image') th.append(el('span', 'pl', ic('play', 20)));
    th.onclick = () => openPlayer(list, n);
    const ci = el('div', 'ci'); const b = el('b'); b.textContent = it.title; ci.append(b, el('br'));
    const sm = el('small'); sm.textContent = `${it.label} | ${it.size ? mb(it.size) : 'stream'} | ${new Date(it.ts).toLocaleDateString()}`; ci.append(sm);
    const ca = el('div', 'ca'), sv = el('button', '', 'Save'), dl = el('button', '', 'Delete');
    sv.onclick = () => it.blob ? saveBlob(it.blob, it.name) : direct(it.src, it.name); dl.onclick = () => remove(it.id);
    ca.append(sv, dl); c.append(th, ci, ca); g.append(c);
  });
  navigator.storage?.estimate?.().then((e) => { $('#lsz').textContent = e.usage ? 'Browser storage: ' + mb(e.usage) : ''; });
}

// ---------- modal ----------
const pm = el('div', 'pm'); pm.hidden = true;
pm.innerHTML = '<div class="pt"><span></span><button data-a="prev" aria-label="Previous">&#8249;</button><button data-a="next" aria-label="Next">&#8250;</button><button data-a="save" aria-label="Save">' + ic('save') + '</button><button data-a="close" aria-label="Close">&#10005;</button></div><div class="stage"></div>';
document.body.append(pm);
const stage = pm.querySelector('.stage'), ptitle = pm.querySelector('.pt span');
let list = [], idx = 0, cur = null;
function openPlayer(l, i) { list = l; idx = i; show(); pm.hidden = false; document.body.style.overflow = 'hidden'; }
function show() { cur && cur.stop(); stage.innerHTML = ''; const it = list[idx]; ptitle.textContent = `${idx + 1}/${list.length}  ${it.title}`; cur = (it.type === 'image' ? imageView : mediaView)(it); stage.append(cur.node); }
function close() { cur && cur.stop(); cur = null; stage.innerHTML = ''; pm.hidden = true; document.body.style.overflow = ''; }
const step = (d) => { idx = (idx + d + list.length) % list.length; show(); };
pm.addEventListener('click', (e) => { const a = e.target.closest('[data-a]')?.dataset.a; if (a === 'close') close(); else if (a === 'prev') step(-1); else if (a === 'next') step(1); else if (a === 'save') { const it = list[idx]; it.blob ? saveBlob(it.blob, it.name) : direct(it.src, it.name); } });
document.addEventListener('keydown', (e) => {
  if (pm.hidden) return;
  if (e.key === 'Escape') return close();
  if (e.key === 'n') return step(1); if (e.key === 'p') return step(-1);
  cur && cur.key(e);
});

function mediaView(it) {
  const isV = it.type === 'video', m = el(isV ? 'video' : 'audio'); m.src = urlOf(it); m.preload = 'metadata'; m.playsInline = true;
  const w = el('div', 'mp ' + it.type);
  if (isV) w.append(m); else { const a = el('div', 'art', ic('note', 90)); if (it.thumb) { const i = el('img'); i.src = it.thumb; i.referrerPolicy = 'no-referrer'; i.onerror = () => i.remove(); a.append(i); } w.append(a, m); }
  const big = el('div', 'big', ic('play', 34)), c = el('div', 'ctl'), seek = el('input', 'seek'); seek.type = 'range'; seek.min = 0; seek.max = 1000; seek.value = 0; seek.setAttribute('aria-label', 'Seek');
  const row = el('div', 'row'), B = (h, a, cls) => { const b = el('button', cls || '', h); b.setAttribute('aria-label', a); return b; };
  const bPlay = B(ic('play'), 'Play'), bBack = B('-10', 'Back 10 seconds', 'tx'), bFwd = B('+10', 'Forward 10 seconds', 'tx'), bMute = B(ic('vol'), 'Mute'), vol = el('input', 'vol'); vol.type = 'range'; vol.min = 0; vol.max = 1; vol.step = .05; vol.value = 1; vol.setAttribute('aria-label', 'Volume');
  const tm = el('span', 'tm', '0:00 / 0:00'), sp = el('span', 'sp'), bSp = B('1x', 'Speed', 'tx'), bLoop = B(ic('loop'), 'Loop'), bPip = B(ic('pip'), 'Picture in picture'), bFs = B(ic('fs'), 'Fullscreen');
  row.append(bPlay, bBack, bFwd, bMute, vol, tm, sp, bSp, bLoop); if (isV) { if (document.pictureInPictureEnabled) row.append(bPip); row.append(bFs); }
  c.append(seek, row); w.append(big, c);
  const SP = [1, 1.25, 1.5, 2, .5, .75]; let si = 0, drag = false, t;
  const poke = () => { w.classList.add('show'); clearTimeout(t); if (!m.paused) t = setTimeout(() => w.classList.remove('show'), 2500); };
  const toggle = () => m.paused ? m.play().catch(() => {}) : m.pause();
  const tick = () => { if (!drag && m.duration) seek.value = m.currentTime / m.duration * 1000; seek.style.setProperty('--p', seek.value / 10 + '%'); tm.textContent = fmt(m.currentTime) + ' / ' + fmt(m.duration); };
  m.onplay = m.onpause = () => { const p = m.paused; bPlay.innerHTML = ic(p ? 'play' : 'pause'); w.classList.toggle('playing', !p); poke(); };
  m.ontimeupdate = tick;
  m.onprogress = m.onloadedmetadata = () => { if (m.buffered.length && m.duration) seek.style.setProperty('--b', m.buffered.end(m.buffered.length - 1) / m.duration * 100 + '%'); tick(); };
  m.onerror = () => { stage.innerHTML = '<div class="msg">Ye file play nahi ho saki. Link expire ho sakta hai, dobara download karo.</div>'; };
  m.onended = () => { if (!m.loop) w.classList.add('show'); };
  seek.oninput = () => { drag = true; if (m.duration) m.currentTime = seek.value / 1000 * m.duration; tick(); }; seek.onchange = () => { drag = false; };
  bPlay.onclick = toggle; bBack.onclick = () => { m.currentTime -= 10; }; bFwd.onclick = () => { m.currentTime += 10; };
  vol.oninput = () => { m.volume = +vol.value; m.muted = false; bMute.innerHTML = ic(+vol.value ? 'vol' : 'mute'); };
  bMute.onclick = () => { m.muted = !m.muted; bMute.innerHTML = ic(m.muted ? 'mute' : 'vol'); };
  bSp.onclick = () => { si = (si + 1) % SP.length; m.playbackRate = SP[si]; bSp.textContent = SP[si] + 'x'; };
  bLoop.onclick = () => { m.loop = !m.loop; bLoop.classList.toggle('on', m.loop); };
  bPip.onclick = () => document.pictureInPictureElement ? document.exitPictureInPicture() : m.requestPictureInPicture().catch(() => {});
  const fs = () => { if (document.fullscreenElement) document.exitFullscreen(); else if (w.requestFullscreen) w.requestFullscreen(); else if (m.webkitEnterFullscreen) m.webkitEnterFullscreen(); };
  bFs.onclick = fs;
  let lt = 0;
  w.addEventListener('click', (e) => { if (e.target.closest('.ctl')) return; const now = Date.now(), r = w.getBoundingClientRect(), right = e.clientX - r.left > r.width / 2; if (now - lt < 300) { m.currentTime += right ? 10 : -10; lt = 0; } else { lt = now; setTimeout(() => { if (lt === now) { toggle(); lt = 0; } }, 300); } poke(); });
  w.addEventListener('pointermove', poke);
  if (!isV) w.classList.add('show');
  m.play().catch(() => {});
  return { node: w, stop() { m.pause(); m.removeAttribute('src'); m.load(); clearTimeout(t); if (document.fullscreenElement) document.exitFullscreen(); },
    key(e) { const k = e.key; if (k === ' ' || k === 'k') { e.preventDefault(); toggle(); } else if (k === 'ArrowRight') m.currentTime += 5; else if (k === 'ArrowLeft') m.currentTime -= 5;
      else if (k === 'ArrowUp') { e.preventDefault(); vol.value = Math.min(1, +vol.value + .1); vol.oninput(); } else if (k === 'ArrowDown') { e.preventDefault(); vol.value = Math.max(0, +vol.value - .1); vol.oninput(); }
      else if (k === 'm') bMute.click(); else if (k === 'f' && isV) fs(); else if (k === 'l') bLoop.click(); poke(); } };
}

function imageView(it) {
  const w = el('div', 'iv'), img = el('img'); img.src = urlOf(it); img.alt = it.title; img.draggable = false;
  let s = 1, x = 0, y = 0, r = 0, d0 = 0, s0 = 1; const pts = new Map();
  const apply = () => { img.style.transform = `translate(${x}px,${y}px) scale(${s}) rotate(${r}deg)`; };
  const zoom = (f) => { s = Math.min(8, Math.max(.5, s * f)); if (s <= 1) x = y = 0; apply(); };
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
  w.onwheel = (e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15); };
  w.onpointerdown = (e) => { w.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { d0 = dist(); s0 = s; } };
  w.onpointermove = (e) => { const p = pts.get(e.pointerId); if (!p) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { s = Math.min(8, Math.max(.5, s0 * dist() / d0)); apply(); } else if (s > 1) { x += e.clientX - p[0]; y += e.clientY - p[1]; apply(); } };
  w.onpointerup = w.onpointercancel = (e) => pts.delete(e.pointerId);
  w.ondblclick = () => { s = s > 1 ? 1 : 2.5; x = y = 0; apply(); };
  const tb = el('div', 'tb'), B = (h, a, f) => { const b = el('button', '', h); b.setAttribute('aria-label', a); b.onclick = f; tb.append(b); };
  B('&minus;', 'Zoom out', () => zoom(1 / 1.3)); B('+', 'Zoom in', () => zoom(1.3)); B('Fit', 'Fit to screen', () => { s = 1; x = y = 0; r = 0; apply(); }); B('&#8635;', 'Rotate', () => { r = (r + 90) % 360; apply(); });
  img.onerror = () => { stage.innerHTML = '<div class="msg">Image load nahi hui. Link expire ho sakta hai.</div>'; };
  w.append(img, tb);
  return { node: w, stop() {}, key(e) { if (e.key === '+' || e.key === '=') zoom(1.3); else if (e.key === '-') zoom(1 / 1.3); else if (e.key === '0') { s = 1; x = y = 0; r = 0; apply(); } else if (e.key === 'r') { r = (r + 90) % 360; apply(); } else if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1); } };
}

window.Lib = { download, addFile };
idb.then(() => tx('readonly', (s) => s.getAll())).then((a) => { items = (a || []).sort((x, y) => y.ts - x.ts); render(); }).catch(() => {});
})();
