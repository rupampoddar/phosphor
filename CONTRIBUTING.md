# Contributing to Phosphor

Thanks for your interest in contributing! Phosphor is a small, dependency-free project and we'd like to keep it that way.

## Philosophy

- **No build step, no dependencies** — vanilla JS + Canvas 2D only. No npm, no bundler, no framework.
- **Potato-PC friendly** — every feature must work on weak hardware. If a feature needs heavy CPU/GPU, it belongs behind a performance toggle.
- **CRT aesthetic** — all UI should feel like a 1960s phosphor terminal. New visualizers, effects, and UI elements should match the existing phosphor glow / scanline / monospace style.

## Getting Started

1. Fork and clone the repo
2. Run locally:
   ```bash
   python3 -m http.server 1960
   ```
3. Open http://localhost:1960 in your browser

No install step. No dependencies to download. Just edit `app.js`, `styles.css`, or `index.html` and refresh.

## Code Style

- **Vanilla JavaScript** — no TypeScript, no transpiler, no modules
- **IIFE wrapper** — the entire app lives inside `(() => { "use strict"; ... })();`
- **Comment sparingly** — explain *why*, not *what*. Skip obvious code, but document non-obvious algorithms, browser quirks, and performance tradeoffs.
- **Follow existing patterns** — panel system, event wiring, localStorage keys (`phosphor-*`), `$()` helper, etc.
- **Verify syntax** before submitting: `node --check app.js`

## Performance

- The app has 4 performance levels (HI-FI 30fps → POTATO 1fps). New features should degrade gracefully.
- Canvas operations should be minimal — reuse cached objects, avoid per-pixel loops where possible.
- The analyser data is read once per frame and shared across all visualizers. Don't add additional `getByteFrequencyData` / `getByteTimeDomainData` calls.

## Pull Requests

1. Keep changes focused — one feature or fix per PR
2. Test on at least two browsers (Chrome + Firefox preferred)
3. Test at POTATO perf level to ensure weak hardware isn't broken
4. Update `README.md` if you add a new feature, keybind, or viz mode

## Reporting Bugs

Include:
- Browser and version
- Performance level
- What you expected vs. what happened
- Steps to reproduce

## License

By contributing, you agree your contributions will be licensed under the MIT License.
