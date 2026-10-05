# Homepage film

Source: `film/claude_clawd_pv/r07-mv/review/r07-stream-film-1080p.mp4` in the primary checkout at `/Users/feida/Developer/afflatus`.

The supplied film is 1616 × 1080, 60 fps, 213.013 seconds, with H.264 video and AAC audio. Its complete 3:2 frame is preserved on the homepage.

`afflatus-r07-1080p.mp4` is the web delivery copy: H.264, 30 fps, CRF 25, AAC 128 kbps and fast-start metadata, approximately 42.5 MiB. The original is unchanged. `afflatus-r07-poster.jpg` is a full-resolution frame at 00:18.

Playback and pointer resizing live in `src/showcase/FilmPlayer.jsx` and `src/showcase/filmMotion.js`. Automatic playback starts muted and respects reduced-motion and Save-Data preferences. The original film remains the authoritative media source.

The mini-player control moves the same video into a draggable card in the browser viewport. Playback time and sound are retained; pointer and keyboard movement stay within the window, including after resizing. Closing the card restores the inline player.
