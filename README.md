# US Mood Downloader

Ek link paste karo, website platform khud pehchan leti hai aur download links nikalti hai. Download ke baad file neeche **library** me aa jati hai, jahan se built-in player me chala sakte ho.

Static website + Vercel serverless functions. Koi build step nahi, koi database nahi.

## Features

- TikTok, Instagram, YouTube, Facebook, Pinterest, SoundCloud, CapCut
- Song ka naam likho to audio (YouTube / Spotify search) mil jata hai
- **Universal API v1 + v2**: har platform ke link par sabse pehle try hoti hain (dropdown me bhi selectable)
- **Installable app (PWA)**: Chrome me "Install App" button aata hai, home screen par app ki tarah khulta hai; offline me bhi UI khulti hai
- **Auto fallback loop**: ek API fail ho to agli try hoti hai, har step ka live message dikhta hai
- Download par progress dikhta hai, file device me save hoti hai
- **Library**: downloaded media browser me store hota hai (IndexedDB), All / Video / Audio / Images tabs
- **Video + audio player**: seek bar (buffered), play/pause, 10s skip, volume, speed (0.5x se 2x), loop, picture-in-picture, fullscreen, double-tap se seek
- **Image viewer**: pinch / wheel zoom, drag, double-tap zoom, rotate, fit, next / previous

## Files

```
index.html     UI, link input, API loop
player.js      library + video/audio player + image viewer
player.css     library aur player ki styling
manifest.webmanifest, sw.js, icons/  PWA (install support)
developer.jpg  About section ki photo (index.html me DEV object se naam, bio, links badlo)
api/dl.js      providers (downloader APIs) + proxy
api/get.js     file ko attachment bana kar stream karta hai
package.json   {"type":"module"}
```

## Deploy (GitHub + Vercel)

1. Is folder ki saari files GitHub repo ke root me upload karo.
2. vercel.com par **Add New > Project**, repo import karo.
3. Framework Preset: **Other**. Build command khali rakho. Deploy dabao.

## Kaise kaam karta hai

1. Browser `/api/dl?order=1&url=...` se is platform ki API list leta hai.
2. List me ek ek API par `/api/dl?url=...&p=<id>` chalata hai. Fail par agli, link milte hi ruk jata hai.
3. Download button par `/api/get` file stream karta hai (CORS aur referer ka masla hal hota hai). Browser file ko blob me leta hai, device me save karta hai aur library me rakhta hai.

## Keyboard shortcuts (player)

| Key | Kaam |
|---|---|
| Space / k | Play, pause |
| Left / Right | 5 second peeche, aage |
| Up / Down | Volume |
| m | Mute |
| f | Fullscreen (video) |
| l | Loop |
| n / p | Agli, pichli file |
| + / - / 0 / r | Image zoom, reset, rotate |
| Esc | Band karo |

## Naya provider add karna

`api/dl.js` me `P` object me entry daalo:

```js
'my-provider': { name: 'My API', plat: 'facebook', run: async (u) => {
  const j = await get(`https://example.com/api?url=${q(u)}`);
  if (!j.status) throw 0;
  return out(j.title, j.thumb, [L('HD', j.hd, 'video'), L('SD', j.sd, 'video')]);
} },
```

Response ka shape pata na ho to `return sweep(j)` use karo, wo JSON me se saare URLs nikal leta hai.

## Environment variables (optional)

| Name | Kaam |
|---|---|
| `SANKA_KEY` | sankavollerei YouTube MP3 API ki key |
| `KAYZU_KEY` | alvianuxio play API ki key |

Repo public rakho to keys code me mat rakho, Vercel me env variables set karo.

## Dhyan rakho

- Ye free, unofficial APIs hain. Kabhi bhi band ya change ho sakti hain. Jo fail hoti hain unhe `api/dl.js` se hata do.
- Library har device aur browser me alag hoti hai, kyunki ye browser ke storage me hai. Browser data clear karne par ya private mode me ye nahi bachti.
- 120 MB se badi file library me store nahi hoti, seedha download hoti hai.
- Vercel Hobby plan par function ka time limit hota hai, bohat badi files beech me ruk sakti hain.
- Facebook kai baar Vercel ke servers ko block karta hai. Sirf public videos chalti hain.
- Sirf apna ya allowed content download karo. Platforms ki terms ka khayal rakho.
