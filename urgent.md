# urgent.md — Ambient Music Player for serial.html (U-ambient-player)

> Status: **implemented** in this commit (frontend + config pipeline). Awaiting station-owner playlist URLs.
> Owner decisions (2026-07-20): external hosting · strict 3-button UI · FLAC + fallback per track.

## 1. Feature summary

A non-profit ambient music player embedded in the reading toolbar of `serial.html`.
Ultra-minimalist by spec: exactly three controls — **[⏮ Previous] [▶/❚❚ Play-Pause] [⏭ Next]**.
No seek bar, no volume slider, no visible track label. Track identity surfaces only through:

- the Play button's hover `title` tooltip (`♪ 曲名 — 艺人`), and
- the OS/browser media overlay via the **Media Session API** (lock-screen / keyboard media keys work for free).

The player is invisible until a valid playlist loads (`hidden` attribute), so the toolbar
never shows dead controls — keeps the U-toolbar-redo "no gaps, no dead space" discipline.

## 2. Architecture

```
public/audio/playlist.json   ← station owner edits this file only (periodic updates)
        │  fetch() on boot (non-blocking, cache: no-store)
        ▼
serial.html inline JS        ← one <audio> element, preload="none"
        │  src = track.src (FLAC/WAV) if canPlayType() OK, else track.fallback
        ▼
External object storage / archive host   ← HTTP Range requests = native streaming
```

**No backend is required.** Lossless "streaming" over HTTP is the browser issuing
`Range:` requests against a static host; every sane host (Cloudflare R2, S3,
archive.org, B2+CDN) supports this natively. `preload="none"` means zero audio bytes
move until the reader presses play — FLAC tracks run 20–60 MB, so this matters.

CORS note: plain `<audio>` playback does **not** need CORS headers. They only matter if
we later add Web-Audio visualization (we are not). Any host serving the raw file works.

Autoplay policy: playback only starts from a user gesture. Never on page load.

## 3. playlist.json contract

```json
{
  "updated": "2026-07-20",
  "tracks": [
    {
      "title": "曲名",
      "artist": "演奏者/来源",
      "src": "https://your-host.example/track-01.flac",
      "fallback": "https://your-host.example/track-01.m4a"
    }
  ]
}
```

Rules the player enforces:

- `src` = lossless file (FLAC/WAV); optional `fallback` = lossy transcode for browsers
  that can't decode the lossless container.
- Entries with empty/missing `src` are skipped — the shipped placeholder file therefore
  keeps the player hidden until real URLs arrive.
- A track that 404s or fails to decode is auto-skipped, with a loop guard: if every
  track fails, the player re-hides itself.
- Updating the rotation = editing this one JSON (fetched with `cache: "no-store"`).

## 4. Audio sourcing policy (read before filling playlist.json)

The station owner supplies a pre-authorized, legally cleared, freely accessible track
list; those URLs get pasted into `playlist.json`. Two ground rules for this repo:

1. **We do not hunt down or mirror lossless rips of commercial recordings.** Cleared
   means the rights-holder or license says so — not "found a FLAC somewhere."
2. Legitimate wells for lossless ambient/classical material when the rotation needs
   topping up: **Musopen** (PD recordings, FLAC), **Wikimedia Commons** (CC/PD audio,
   stable URLs), **IMSLP** (PD recordings), **Free Music Archive** (per-track CC —
   check each), and self-commissioned recordings. Keep a `LICENSES.md` beside the
   playlist noting the license per track.

## 5. UI implementation (matches existing toolbar system)

- Markup: `.player` button-cluster in `#toolbar`, after 自动翻页, before the spacer —
  reading aids stay grouped, bookmark stays right-aligned.
- Styling reuses the `.fsize` cluster pattern and existing chrome tokens (`--mono`,
  `--chrome`, `--teal`) — no new colors; both eye-care reading themes untouched
  (toolbar is chrome, not reader surface).
- Mobile ≤640px: toolbar is already a single scrollable row (nowrap, icon-only); the
  three buttons are `flex:0 0 auto` with 44px touch targets — no wrap, no overlap.
- Toolbar height stays gap-free via the existing `--toolbar-h` ResizeObserver.
- Play state mirrors `#autoToggle`: glyph ▶ ⇄ ❚❚ plus `.active` class.

## 6. State & session behavior

- `localStorage`: `afflatus:novels:player:idx` (last track index). Playback position is
  deliberately **not** persisted — ambient rotation, not an audiobook.
- Auto-advance on `ended`; ⏮/⏭ wrap around.
- Media Session: `play/pause/previoustrack/nexttrack` + metadata (album "Afflatus 伴读").

## 7. QA checklist

- [ ] playlist with 0 valid tracks → player stays `hidden`, toolbar unchanged.
- [ ] FLAC-capable browser picks `src`; legacy picks `fallback`.
- [ ] 404 track → auto-skip; all-fail → player re-hides (no retry loop).
- [ ] Mobile 375px: single row, horizontal scroll, no overlap with 书签 chip.
- [ ] Media keys / lock-screen controls work.
- [ ] Zero audio bytes fetched before first press (`preload="none"`, Network tab).

## 8. Later (explicitly out of scope)

Volume memory, shuffle, per-novel playlists (`novel.playlistId`), fade on tab hide,
LICENSES.md automation.
