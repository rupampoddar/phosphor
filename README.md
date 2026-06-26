# PHOSPHOR // 196X

A web-based music player with a CRT phosphor terminal aesthetic. Tune into free internet radio or drop in local audio files — no build step, no dependencies, runs on a potato. 13 visualizer modes, playlist queue, favourites, playback history, liked tracks, and a 3D-reactive starfield.

Local audio files never leave your browser. Phosphor plays dropped files directly from your device and stores preferences, favourites, history, and liked tracks in `localStorage`.

![License](https://img.shields.io/badge/license-MIT-33ff33) ![no deps](https://img.shields.io/badge/dependencies-zero-44aaff) ![potato](https://img.shields.io/badge/potato%20friendly-ffb000)

**[Live Demo →](https://rupampoddar.com/phosphor)**

<!-- Hero screenshot — capture a wide shot of the player with SCOPE viz + amber theme -->
![Phosphor hero shot](assets/phosphor-scope.png)

---

## Features

- **Internet radio** — 12 free SomaFM stations built in + RadioBrowser search (thousands of stations)
- **Drag & drop audio** — drop any audio file (MP3, WAV, OGG, M4A, FLAC, Opus, WebM) onto the screen
- **Folder import** — import an entire directory (folder button or `F` key)
- **Playlist / queue** — multi-file drop auto-queues tracks, auto-advance, `Q` toggles queue panel
- **13 visualizer modes** — scope, bars, VU, LEDs, lissajous, waterfall, sonar, ripples, warp, horizon, particles, radar, off
- **4 phosphor themes** — Amber (P3), Green (P1), Blue (P11), White (P4)
- **CRT channel-switch effect** — retro static/sync-loss animation when changing stations
- **CRT HUD overlay** — live system info panel (state, station, track, format, viz, volume)
- **Typewriter title cycling** — radio now-playing alternates station ↔ track with backspace/type animation
- **Playback history** — automatic timeline of every session with timestamps, duration, and end reason
- **Liked tracks** — heart button saves radio track names for later lookup
- **Favourites** — star stations to pin them to the top
- **Repeat modes** — off / all / one
- **Authentic CRT effects** — scanlines, phosphor bloom, screen curvature vignette, flicker, afterglow persistence, mouse-tracked glare, animated sweep line
- **"NO SIGNAL" idle** — TV static noise on boot with "PRESS R FOR RADIO" hint
- **Audio-reactive** — screen brightness modulates with audio level
- **Potato-PC optimized** — 4 performance levels from HI-FI (30fps) down to POTATO (1fps)

## Quick Start

No build, no install. Serve the folder with any static server:

```bash
git clone https://github.com/rupampoddar/phosphor.git
cd phosphor
python3 -m http.server 1960
```

Open http://localhost:1960 in your browser.

> A server is needed because browsers require `http://` (not `file://`) for Web Audio + drag-and-drop to work.

## Screenshots

### Visualizers

| | | |
|---|---|---|
| ![Scope](assets/phosphor-scope.png) | ![Bars](assets/phosphor-bars.png) | ![VU](assets/phosphor-vu.png) |
| *SCOPE* | *BARS* | *VU* |
| ![LEDs](assets/phosphor-leds.png) | ![Lissajous](assets/phosphor-lissajous.png) | ![Waterfall](assets/phosphor-waterfall.png) |
| *LEDS* | *LISSAJOUS* | *WATERFALL* |
| ![Sonar](assets/phosphor-sonar.png) | ![Ripples](assets/phosphor-ripples.png) | ![Warp](assets/phosphor-warp.png) |
| *SONAR* | *RIPPLES* | *WARP* |
| ![Horizon](assets/phosphor-horizon.png) | ![Particles](assets/phosphor-particles.png) | ![Radar](assets/phosphor-radar.png) |
| *HORIZON* | *PARTICLES* | *RADAR* |

### UI

| | |
|---|---|
| ![HUD](assets/phosphor-hud.png) | ![Radio](assets/phosphor-radio.png) |
| *CRT HUD overlay* | *Radio station panel* |
| ![History](assets/phosphor-history.png) | |
| *History / liked tracks* | |

## Controls

| Key | Action |
|-----|--------|
| Space | Play / Pause |
| N | Next track |
| ← / → | Seek ±5s |
| ↑ / ↓ | Volume |
| M | Mute |
| R | Toggle radio panel |
| T | Cycle phosphor theme |
| V | Cycle visualization mode |
| P | Cycle performance level |
| Q | Toggle playlist / queue |
| F | Import folder |
| Y | Toggle favourite (station) |
| X | Cycle repeat mode (off / all / one) |
| I | Toggle CRT HUD overlay |
| H | Toggle history / liked tracks panel |
| Esc | Close panels |

Click the radio, folder, or history buttons, or drop files anywhere. Click the screen to toggle the HUD. Click the heart next to the title to like the current radio track.

## Themes

| | | | |
|---|---|---|---|
| ![Amber](assets/phosphor-theme-amber.png) | ![Green](assets/phosphor-theme-green.png) | ![Blue](assets/phosphor-theme-blue.png) | ![White](assets/phosphor-theme-white.png) |
| *Amber (P3)* | *Green (P1)* | *Blue (P11)* | *White (P4)* |

| Theme | Phosphor Color | Vibe |
|-------|---------------|------|
| Amber (P3) | `#ffb000` | IBM 3278 terminal |
| Green (P1) | `#33ff33` | Classic VT100 / hacker |
| Blue (P11) | `#44aaff` | Tektronix oscilloscope |
| White (P4) | `#cccccc` | Early TV / monochrome |

All preferences (theme, viz, perf, volume, favourites, repeat, HUD, history, liked tracks) are saved in `localStorage` and persist across sessions.

## Visualization Modes

| Mode | Description |
|------|-------------|
| SCOPE | Oscilloscope waveform (time-domain) |
| BARS | Frequency spectrum bars (logarithmic) |
| VU | Vertical VU meters (bass / mid / treble) |
| LEDS | LED-bar frequency display (logarithmic) |
| LISSAJOUS | X/Y phase plot |
| WATERFALL | Scrolling frequency spectrogram |
| SONAR | Radial sweep with history trail |
| RIPPLES | Concentric audio-reactive rings |
| WARP | 3D starfield with audio-reactive warp speed |
| HORIZON | 3D frequency terrain (ring buffer heightmap) |
| PARTICLES | 2D audio-reactive particle field |
| RADAR | Circular oscilloscope with rotating sweep |
| OFF | Static graticule only (minimal CPU) |

BARS, LEDS, and HORIZON use logarithmic frequency bin mapping so lows and highs are both visible.

## Performance Levels

| Level | FPS | Description |
|-------|-----|-------------|
| HI-FI | 30 | Full effects, smooth animation |
| NORMAL | 15 | Balanced (default) |
| LO-FI | 8 | Reduced effects, silent-adaptive |
| POTATO | 1 | Minimal animation for weakest devices |

Framerate auto-drops when audio is silent. All perf levels are saved in `localStorage`.

## Radio

### SomaFM (12 built-in)

All streams from [SomaFM](https://somafm.com) (free, listener-supported). SomaFM streams are CORS-enabled, so they route through the Web Audio analyser — the visualizer is fully reactive to radio, not just local files.

| Station | Channel | Vibe |
|---------|---------|------|
| Deep Space One | `deepspaceone` | Space ambient electronica |
| Mission Control | `missioncontrol` | Ambient + NASA mission control audio |
| The Trip | `thetrip` | Progressive house / trance |
| Groove Salad | `groovesalad` | Ambient downtempo |
| Drone Zone | `dronezone` | Served best chilled, atmospheric |
| Secret Agent | `secretagent` | Spy jazz / lounge |
| Sonic Universe | `sonicuniverse` | Space age jazz / soul |
| Beat Blender | `beatblender` | Late-night downtempo beats |
| Space Station | `spacestation` | Ambient space, 7Hz drone |
| Def Con | `defcon` | Ambient cyberpunk / tech |
| Suburbs of Goa | `suburbsofgoa` | Desi / worldbeat |
| u80s | `u80s` | 80s underground / synthpop |

Now-playing metadata is fetched from `somafm.com/songs/<channel>.json` every 15 seconds.

### RadioBrowser Search

Search thousands of free stations via [RadioBrowser](https://www.radio-browser.info/). CORS-enabled stations play through the Web Audio analyser (full visualizer); non-CORS stations fall back to direct audio playback (audio-only, no visualizer).

## History & Liked Tracks

### Playback History

Every time you play a local file or radio station, a history entry is recorded automatically. Each entry captures:

- **Title** — filename or "Station — Track" (for radio with metadata)
- **Timestamp** — when playback started (shown as relative time: "2m ago")
- **Duration** — how long it played
- **End reason** — `DONE` (completed), `SKIP` (switched), `ERR` (error)

History auto-rotates after 200 entries. Open with the `H` key or history button.

### Liked Tracks

When listening to radio with SomaFM track metadata, a heart button appears next to the now-playing title. Click it to save the current track. Each liked entry stores the track name, station, and timestamp. Liked tracks are deduplicated by track + station and auto-rotate after 200 entries.

Both history and liked tracks are persisted in `localStorage`.

## Architecture

```
phosphor/
├── index.html      # Markup: player, panels, HUD, controls
├── styles.css      # CRT phosphor theme system, scanlines, animations, responsive
├── app.js          # Web Audio graph, 13 viz modes, radio, queue, persistence, CRT effects
├── assets/         # Screenshots
├── LICENSE          # MIT
├── CONTRIBUTING.md  # Contribution guidelines
└── README.md        # You are here
```

### Potato-PC Optimizations

- **No dependencies** — vanilla JS + Canvas 2D, no framework, no build step
- **4 performance levels** — from HI-FI (30fps) down to POTATO (1fps)
- **Adaptive framerate** — drops to 5fps when silent, 2fps when viz is off
- **Minimal draw calls** — oscilloscope = 1 polyline, bars = 32 fillRects
- **Cached graticule** — static grid rendered once, stamped via `drawImage()`
- **Phosphor persistence** — semi-transparent overlay instead of full clear + redraw
- **Deduped analyser reads** — frequency/time data read once per frame, shared across modes
- **Capped device pixel ratio** — max 1.25x DPR
- **`alpha:false` + `desynchronized:true`** canvas context
- **Visibility-aware** — RAF cancels when tab is hidden
- **CSS-only CRT effects** — scanlines, flicker, vignette are pure CSS (zero canvas cost)

### Tech

- Web Audio API (`AudioContext`, `AnalyserNode`, `MediaElementSource`)
- Canvas 2D (`getContext("2d", { alpha: false, desynchronized: true })`)
- CSS Custom Properties for zero-cost theme switching
- `localStorage` for all persistence
- No libraries, no frameworks, no bundler

## Self-Hosting

Phosphor is a static site — drop the folder on any web server and it works. For self-hosted fonts (instead of Google Fonts), download **IBM Plex Mono** (400, 500, 600) and **VT323**, then replace the `<link>` in `index.html` with local `@font-face` declarations.

## Credits

- **[SomaFM](https://somafm.com)** — free, listener-supported internet radio. [Donate](https://somafm.com/support/).
- **[RadioBrowser](https://www.radio-browser.info/)** — community-driven open radio station directory.
- **[IBM Plex Mono](https://github.com/IBM/plex)** — terminal UI font by IBM.
- **[VT323](https://fonts.google.com/specimen/VT323)** — CRT display font by Peter Hull.

## License

[MIT](LICENSE) — Copyright (c) 2026 Rupam Poddar
