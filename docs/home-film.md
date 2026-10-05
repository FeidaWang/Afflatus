# Homepage film

Source: `film/claude_clawd_pv/r07-mv/review/r07-stream-film-1080p-16x9.mp4` in the primary checkout at `/Users/feida/Developer/afflatus`.

The supplied film is 1920 × 1080, 213.013 seconds, with H.264 video and AAC audio. Its complete 16:9 frame is preserved on the homepage.

The public copy at the same relative path under `public/` uses H.264, CRF 23, the source AAC audio stream, and fast-start metadata, totaling 82,576,797 bytes. The original is unchanged and is not published. `afflatus-r07-poster.jpg` is a full-resolution frame at 00:00. The obsolete 3:2 public delivery copy has been removed.

Playback and pointer resizing live in `src/showcase/FilmPlayer.jsx` and `src/showcase/filmMotion.js`. Automatic playback starts muted and respects reduced-motion and Save-Data preferences. The original film remains the authoritative media source.

The mini-player control moves the same video into a draggable card in the browser viewport. Its default width is 66% of the viewport, bounded by a 240px usable minimum, 570px desktop maximum, and the available viewport width and height. Compact mode uses 44% with a 360px maximum. Playback time and sound are retained; pointer and keyboard movement stay within the window, including after resizing. Closing the card restores the inline player. The inline slot becomes a black stage with a localized picture-in-picture caption that also returns playback to the page.

The normal and fullscreen player have no upper-left branding overlay. The floating mini player uses a custom warm copper recursive-arrow mark followed by `rsiagent.app`. Its drag handle contains the complete brand group. The desktop header has 24px of left padding, a 32px mark, and a 14px logo-to-text gap. Container-relative sizing adjusts every button, icon, logo, type size, and spacing continuously with the actual floating window width, including compact mode. Utility buttons retain a 36px minimum target and the central play button a 44px minimum. The logo at `public/assets/film/rsiagent-mark.png` was created with the built-in image generation tool and retains transparency; its generation prompt is saved in `artifacts/film-player/rsiagent-logo-prompt.txt`.

The inline right-side controls are sound, mini player, then fullscreen. Hovering or focusing sound opens a frosted capsule with a continuous volume slider. Setting volume to zero mutes; unmuting restores the last nonzero volume. Sound uses a solid speaker, mute a diagonal slash, and fullscreen square corners. The ordinary seek track sits 6px below the toolbar instead of the former 18px.

The mini player omits the bottom-right buttons; its top-right actions are compact size, return to page (a window with an outward arrow and a smaller filled window), and close. The seek control has a tall rounded thumb with a gap in the track on each side. Rewind/forward digits are centered in their arrow rings; the play/pause control has translucent white glass with backdrop blur. When the pointer leaves the mini player, the header, center controls, footer, and dark shade disappear. Keyboard-visible focus keeps controls accessible; touch interaction reveals them for 2.8 seconds. Browser blur also hides them.

There is no settings menu or speed selector. Both the inline player and cinema fallback lock current and default playback rates to 1×, including after a browser-generated rate change.

The vendored return-to-page and mute assets come from Google's Material Design Icons: [`back_to_tab`](https://github.com/google/material-design-icons/blob/master/symbols/web/back_to_tab/materialsymbolsoutlined/back_to_tab_24px.svg) and [`volume_off`](https://github.com/google/material-design-icons/blob/master/src/av/volume_off/materialicons/24px.svg). Their Apache 2.0 license is included at `public/assets/film/material-icons-LICENSE.txt`. Other controls use the existing Phosphor icon library.

Film links and download shortcuts are omitted from the live player, error state, cinema fallback, and static homepage. A failed load offers Retry. The video area suppresses the context menu; both media elements request `nodownload noplaybackrate noremoteplayback` controls and disable native picture-in-picture and remote playback. The site's own draggable mini player remains available.

These are interface restrictions, not DRM or access control. The web delivery stream must remain accessible to a browser that plays it, so network inspection or screen capture can still obtain it. The high-quality source in the primary checkout is not served by the site.
