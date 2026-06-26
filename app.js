(() => {
  "use strict";

  // ========== Elements ==========
  const $ = (id) => document.getElementById(id);
  const drop      = $("drop");
  const fileIn    = $("file");
  const player    = $("player");
  const viz       = $("viz");
  const screen    = $("screen");
  const titleEl   = $("title");
  const curEl     = $("cur");
  const durEl     = $("dur");
  const seek      = $("seek");
  const playBtn   = $("play");
  const muteBtn   = $("mute");
  const prevBtn   = $("prev");
  const openBtn   = $("open");
  const volEl     = $("vol");
  const led       = $("led");
  const statusTxt = $("statusTxt");
  const radioBtn  = $("radio");
  const stations  = $("stations");
  const stList    = $("stList");
  const vizModeBtn = $("vizMode");
  const themeBtn  = $("themeBtn");
  const perfBtn   = $("perfBtn");
  const queueBtn  = $("queueBtn");
  const queuePanel = $("queuePanel");
  const qList     = $("qList");
  const nextBtn   = $("next");
  const repeatBtn = $("repeat");
  const folderBtn = $("folderBtn");
  const folderIn  = $("folderIn");
  const trackCountEl = $("trackCount");
  const likeBtn   = $("likeBtn");
  const historyBtn = $("historyBtn");
  const historyPanel = $("historyPanel");
  const histList  = $("histList");
  const tabHistory = $("tabHistory");
  const tabLiked  = $("tabLiked");
  const histFoot  = $("histFoot");

  const ctx = viz.getContext("2d", { alpha: false, desynchronized: true });
  const ICON_SPRITE = "assets/icons.svg#";

  function setIcon(el, icon) {
    if (!el) return;
    el.replaceChildren(createIcon(icon));
  }

  function createIcon(icon) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    svg.classList.add("ico");
    svg.setAttribute("aria-hidden", "true");
    use.setAttribute("href", ICON_SPRITE + icon);
    svg.appendChild(use);
    return svg;
  }

  // ========== Audio state ==========
  let audio = null, radioEl = null, directEl = null;
  let actx = null, analyser = null, gainNode = null;
  let fileSource = null, radioSource = null;
  let freqData = null, timeData = null;
  let currentURL = null;
  let mode = null; // 'file' | 'radio' | null
  let rafId = 0;
  let queue = [];
  let queueIdx = -1;
  let vizLimited = false; // true when non-CORS station plays audio-only
  let repeatMode = 0; // 0=off, 1=repeat-all, 2=repeat-one
  let favourites = []; // [{name, url, channel?}]
  let fileDialogOpen = false;
  let currentStation = null; // {name, url, channel} of playing radio station

  // History & liked tracks
  const HISTORY_MAX = 200;
  const LIKED_MAX = 200;
  let history = [];
  let likedTracks = [];
  let currentHistoryEntry = null;
  let historyTab = "history"; // "history" | "liked"

  const DPR = Math.min(window.devicePixelRatio || 1, 1.25);
  const FRAME_MS_IDLE   = 1000 / 5;   // 5fps when silent
  const FRAME_MS_OFF    = 1000 / 2;   // 2fps when viz is off
  let lastFrame = 0, prevDraw = 0;

  // ========== Performance level system ==========
  const PERF_LEVELS = [
    { label: "PERF: HI-FI",   fps: 30, fft: 256 },
    { label: "PERF: NORMAL",  fps: 15, fft: 128 },
    { label: "PERF: LO-FI",   fps: 8,  fft: 64  },
    { label: "PERF: POTATO",  fps: 1,  fft: 32  }
  ];
  let perfIdx = 1; // Default to NORMAL

  // ========== Canvas geometry ==========
  let W = 0, H = 0;
  let gridCanvas = null; // cached graticule

  // Smoothed audio levels
  let bassS = 0, midS = 0, trebS = 0, levelS = 0;
  let silentFrames = 0;
  let lastBrightness = 1;

  // Status echo state
  let statusOn = false, statusText = "STANDBY";
  let flashTimer = 0;
  let metaTimer = 0;

  // ========== Theme system ==========
  const THEMES = [
    { key: null,     label: "AMBER" },
    { key: "green",  label: "GREEN" },
    { key: "blue",   label: "BLUE"  },
    { key: "white",  label: "WHITE" },
  ];
  let themeIdx = 0;
  let phosphorColor = "#ffb000";
  let phosphorDim   = "#996a00";
  let phosphorBright = "#ffe066";

  // ========== Viz mode system ==========
  const VIZ_MODES = ["SCOPE", "BARS", "VU", "LEDS", "LISSAJOUS", "WATERFALL", "SONAR", "RIPPLES", "WARP", "HORIZON", "PARTICLES", "RADAR", "OFF"];
  let vizIdx = 0;

  // VU needle physics state
  let vuL = 0, vuR = 0;
  let vuLVel = 0, vuRVel = 0;

  // LED spectrum peak-hold state
  const LED_BANDS = 14;
  let ledPeaks = Array(LED_BANDS).fill(0);
  let ledPeakDecay = Array(LED_BANDS).fill(0);

  // Sonar sweep hand state
  let sonarAngle = 0;

  // Warp starfield state
  const WARP_STARS = 120;
  let warpStars = [];
  let warpSpeed = 0.5;
  let warpInited = false;

  // Horizon terrain state — ring buffer of frequency snapshots
  const HORIZON_ROWS = 24;
  const HORIZON_BINS = 32;
  let horizonHistory = [];
  let horizonScroll = 0;

  // Particle field state
  const PARTICLE_COUNT = 80;
  let particles = [];
  let particlesInited = false;

  // Radar scope state
  let radarRotation = 0;

  // ========== Noise texture for idle "NO SIGNAL" ==========
  let noiseCanvas = null;
  let noiseCtx = null;
  let noiseImageData = null;
  const NOISE_W = 128, NOISE_H = 96;

  // ========== CRT channel-switch effect ==========
  let channelSwitchUntil = 0;
  const CHANNEL_SWITCH_MS = 500;

  // ========== Helpers ==========
  const fmt = (s) => {
    if (!isFinite(s) || s < 0) s = 0;
    const m = (s / 60) | 0, r = (s % 60) | 0;
    return m + ":" + (r < 10 ? "0" : "") + r;
  };
  const baseName = (n) => n.replace(/\.[^./\\]+$/, "").replace(/[_]+/g, " ");
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const avg = (arr, a, b) => {
    let s = 0, n = 0;
    for (let i = a; i < b && i < arr.length; i++) { s += arr[i]; n++; }
    return n ? s / n : 0;
  };
  // Logarithmic bin mapping: returns {start, end} for band i of count
  // Distributes bars across frequency range logarithmically (more bars for lows)
  const logBin = (i, count, total) => {
    const logMin = 0;
    const logMax = Math.log(total);
    const t0 = i / count;
    const t1 = (i + 1) / count;
    const start = Math.floor(Math.exp(logMin + t0 * (logMax - logMin)));
    const end = Math.max(start + 1, Math.floor(Math.exp(logMin + t1 * (logMax - logMin))));
    return { start: Math.min(start, total - 1), end: Math.min(end, total) };
  };

  // ========== Read CSS phosphor colors ==========
  function readPhosphorColors() {
    const cs = getComputedStyle(document.documentElement);
    phosphorColor  = cs.getPropertyValue("--phosphor").trim();
    phosphorDim    = cs.getPropertyValue("--phosphor-dim").trim();
    phosphorBright = cs.getPropertyValue("--phosphor-bright").trim();
    // Rebuild graticule with new colors
    if (W > 0 && H > 0) buildGraticule();
  }

  // ========== Theme switching ==========
  function applyTheme(idx) {
    themeIdx = idx;
    const t = THEMES[idx];
    if (t.key) {
      document.documentElement.setAttribute("data-theme", t.key);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    themeBtn.textContent = t.label;
    localStorage.setItem("phosphor-theme", idx);
    // Need a microtask delay for CSS to apply before reading computed values
    requestAnimationFrame(() => readPhosphorColors());
  }

  function cycleTheme() {
    applyTheme((themeIdx + 1) % THEMES.length);
    flashStatus("THEME: " + THEMES[themeIdx].label);
  }

  // ========== Viz mode switching ==========
  function applyVizMode(idx) {
    vizIdx = idx;
    vizModeBtn.textContent = VIZ_MODES[idx];
    localStorage.setItem("phosphor-viz", idx);
    if (hudViz) hudViz.textContent = VIZ_MODES[idx];
  }

  function cycleVizMode() {
    applyVizMode((vizIdx + 1) % VIZ_MODES.length);
    flashStatus("VIZ: " + VIZ_MODES[vizIdx]);
  }

  // ========== Performance switching ==========
  function applyPerfLevel(idx) {
    perfIdx = idx;
    const level = PERF_LEVELS[idx];
    perfBtn.textContent = level.label;
    localStorage.setItem("phosphor-perf", idx);

    // Dynamically update audio graph parameters if active
    if (analyser) {
      try {
        analyser.fftSize = level.fft;
        freqData = new Uint8Array(analyser.frequencyBinCount);
        timeData = new Uint8Array(analyser.fftSize);
      } catch (err) { /* fftSize constraint failed — keep previous */ }
    }
  }

  function cyclePerfLevel() {
    applyPerfLevel((perfIdx + 1) % PERF_LEVELS.length);
    flashStatus(PERF_LEVELS[perfIdx].label);
  }

  // ========== Noise texture ==========
  function generateNoise() {
    noiseCanvas = document.createElement("canvas");
    noiseCanvas.width = NOISE_W;
    noiseCanvas.height = NOISE_H;
    noiseCtx = noiseCanvas.getContext("2d");
    noiseImageData = noiseCtx.createImageData(NOISE_W, NOISE_H);
  }

  function drawNoise() {
    // Regenerate noise each frame for TV-static effect
    const d = noiseImageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 35) | 0;
      d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
    }
    // Put noise on the small offscreen canvas, then stretch to main canvas
    noiseCtx.putImageData(noiseImageData, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(noiseCanvas, 0, 0, W, H);
    ctx.imageSmoothingEnabled = true;

    // "NO SIGNAL" text
    ctx.fillStyle = phosphorDim;
    ctx.font = "20px 'VT323', 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("NO SIGNAL", W / 2, H / 2);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  // ========== Layout ==========
  function layout() {
    const rect = viz.getBoundingClientRect();
    W = rect.width | 0;
    H = rect.height | 0;
    viz.width = (W * DPR) | 0;
    viz.height = (H * DPR) | 0;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    buildGraticule();
    generateNoise();
  }

  // ========== Cached graticule (static grid) ==========
  function buildGraticule() {
    // Create offscreen canvas for static grid
    gridCanvas = document.createElement("canvas");
    gridCanvas.width = (W * DPR) | 0;
    gridCanvas.height = (H * DPR) | 0;
    const gc = gridCanvas.getContext("2d");
    gc.setTransform(DPR, 0, 0, DPR, 0, 0);

    const cols = 8, rows = 6;
    const cw = W / cols, ch = H / rows;

    // Grid lines
    gc.strokeStyle = phosphorDim;
    gc.globalAlpha = 0.15;
    gc.lineWidth = 1;
    gc.beginPath();
    for (let i = 1; i < cols; i++) {
      gc.moveTo(i * cw, 0);
      gc.lineTo(i * cw, H);
    }
    for (let i = 1; i < rows; i++) {
      gc.moveTo(0, i * ch);
      gc.lineTo(W, i * ch);
    }
    gc.stroke();

    // Center crosshair (dashed)
    gc.globalAlpha = 0.25;
    gc.setLineDash([4, 6]);
    gc.beginPath();
    gc.moveTo(W / 2, 0); gc.lineTo(W / 2, H);
    gc.moveTo(0, H / 2); gc.lineTo(W, H / 2);
    gc.stroke();
    gc.setLineDash([]);

    // Border
    gc.globalAlpha = 0.35;
    gc.strokeStyle = phosphorColor;
    gc.lineWidth = 1;
    gc.strokeRect(0.5, 0.5, W - 1, H - 1);

    // Corner tick marks
    gc.globalAlpha = 0.4;
    gc.lineWidth = 1.5;
    const tk = 8;
    gc.beginPath();
    // Top-left
    gc.moveTo(1, tk); gc.lineTo(1, 1); gc.lineTo(tk, 1);
    // Top-right
    gc.moveTo(W - tk, 1); gc.lineTo(W - 1, 1); gc.lineTo(W - 1, tk);
    // Bottom-left
    gc.moveTo(1, H - tk); gc.lineTo(1, H - 1); gc.lineTo(tk, H - 1);
    // Bottom-right
    gc.moveTo(W - tk, H - 1); gc.lineTo(W - 1, H - 1); gc.lineTo(W - 1, H - tk);
    gc.stroke();

    // Labels
    gc.globalAlpha = 0.3;
    gc.fillStyle = phosphorColor;
    gc.font = "12px 'VT323', 'IBM Plex Mono', monospace";
    gc.textBaseline = "top";
    gc.textAlign = "left";
    gc.fillText("FREQ ANALYSIS", 6, 4);
    gc.textAlign = "right";
    gc.fillText("CH-1", W - 6, 4);

    // dB scale on left (for bars mode, but always visible)
    gc.textAlign = "left";
    gc.font = "10px 'VT323', 'IBM Plex Mono', monospace";
    gc.globalAlpha = 0.2;
    for (let i = 0; i <= rows; i++) {
      const db = -i * 10;
      gc.fillText(db + "dB", 4, i * ch + 2);
    }

    gc.globalAlpha = 1;
    gc.textAlign = "start";
    gc.textBaseline = "alphabetic";
  }

  // ========== Draw: Oscilloscope waveform ==========
  function drawScope(yOffset, height) {
    if (!timeData) return;

    const len = timeData.length;
    const sliceW = W / len;
    const centerY = yOffset + height / 2;

    // Glow pass (thicker, dimmer)
    ctx.strokeStyle = phosphorDim;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < len; i++) {
      const v = (timeData[i] / 128.0) - 1;
      const y = centerY + v * (height * 0.45);
      if (i === 0) ctx.moveTo(0, y);
      else ctx.lineTo(i * sliceW, y);
    }
    ctx.stroke();

    // Core pass (thin, bright)
    ctx.strokeStyle = phosphorBright;
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < len; i++) {
      const v = (timeData[i] / 128.0) - 1;
      const y = centerY + v * (height * 0.45);
      if (i === 0) ctx.moveTo(0, y);
      else ctx.lineTo(i * sliceW, y);
    }
    ctx.stroke();
  }

  // ========== Draw: Frequency bars ==========
  function drawBars(yOffset, height) {
    if (!freqData) return;

    const barCount = 32;
    const total = freqData.length;
    const gap = 2;
    const barW = (W - gap * (barCount - 1)) / barCount;

    for (let i = 0; i < barCount; i++) {
      const range = logBin(i, barCount, total);
      const val = avg(freqData, range.start, range.end) / 255;
      const barH = val * height * 0.9;

      const x = i * (barW + gap);
      const y = yOffset + height - barH;

      ctx.fillStyle = phosphorColor;
      ctx.globalAlpha = 0.6 + val * 0.4;
      ctx.fillRect(x, y, barW, barH);

      if (barH > 2) {
        ctx.fillStyle = phosphorBright;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(x, y, barW, 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ========== Draw: Analog VU Meter ==========
  function drawVU(yOffset, height) {
    const centerY = yOffset + height * 0.82;
    const radius = Math.min(W * 0.18, height * 0.68);
    const tickLen = 8;

    const centers = [
      { x: W * 0.26, label: "L", level: vuL },
      { x: W * 0.74, label: "R", level: vuR }
    ];

    centers.forEach((c) => {
      const cx = c.x;
      const cy = centerY;

      // Draw dial arc
      ctx.strokeStyle = phosphorDim;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();

      // Tick marks and labels
      const ticks = [
        { v: 0.0,  lbl: "-20" },
        { v: 0.25, lbl: "-10" },
        { v: 0.5,  lbl: "-5"  },
        { v: 0.7,  lbl: "-3"  },
        { v: 0.85, lbl: "0"   },
        { v: 1.0,  lbl: "+3"  }
      ];

      ticks.forEach((t) => {
        const angle = Math.PI * 1.2 + t.v * (Math.PI * 0.6);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // Tick line
        ctx.strokeStyle = t.v >= 0.85 ? phosphorBright : phosphorColor;
        ctx.globalAlpha = t.v >= 0.85 ? 0.8 : 0.4;
        ctx.lineWidth = t.v >= 0.85 ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.moveTo(cx + cos * radius, cy + sin * radius);
        ctx.lineTo(cx + cos * (radius - tickLen), cy + sin * (radius - tickLen));
        ctx.stroke();

        // Labels
        ctx.fillStyle = t.v >= 0.85 ? phosphorBright : phosphorDim;
        ctx.globalAlpha = t.v >= 0.85 ? 0.9 : 0.5;
        ctx.font = "11px 'VT323', 'IBM Plex Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(t.lbl, cx + cos * (radius - tickLen - 8), cy + sin * (radius - tickLen - 8));
      });

      // Channel label
      ctx.fillStyle = phosphorColor;
      ctx.globalAlpha = 0.5;
      ctx.font = "16px 'VT323', 'IBM Plex Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(c.label, cx, cy - radius * 0.4);
      ctx.font = "12px 'VT323', 'IBM Plex Mono', monospace";
      ctx.fillText("VU METER", cx, cy - radius * 0.2);

      // Needle shadow
      const needleAngle = Math.PI * 1.2 + c.level * (Math.PI * 0.6);
      const nCos = Math.cos(needleAngle);
      const nSin = Math.sin(needleAngle);

      ctx.strokeStyle = phosphorDim;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + nCos * (radius - 4), cy + nSin * (radius - 4));
      ctx.stroke();

      // Needle core
      ctx.strokeStyle = phosphorBright;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + nCos * (radius - 2), cy + nSin * (radius - 2));
      ctx.stroke();

      // Pivot cap
      ctx.fillStyle = phosphorColor;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = phosphorDim;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    ctx.globalAlpha = 1;
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  // ========== Draw: LED Columns Spectrum ==========
  function drawLEDs(yOffset, height, dt) {
    if (!freqData) return;

    const cols = 14;
    const segments = 15;
    const gap = 6;
    const segGap = 2;
    const total = freqData.length;

    const colW = (W - gap * (cols - 1)) / cols;
    const segH = (height - segGap * (segments - 1)) / segments;

    const now = performance.now();

    for (let i = 0; i < cols; i++) {
      const range = logBin(i, cols, total);
      const val = avg(freqData, range.start, range.end) / 255;

      const activeSegs = Math.round(val * segments);

      // Peak-hold logic
      if (activeSegs >= ledPeaks[i]) {
        ledPeaks[i] = activeSegs;
        ledPeakDecay[i] = now + 650;
      } else if (now > ledPeakDecay[i]) {
        const fallback = (dt > 0 ? dt : 66) * 0.008;
        ledPeaks[i] = Math.max(0, ledPeaks[i] - fallback);
      }

      const peakIdx = Math.floor(ledPeaks[i]) - 1;
      const x = i * (colW + gap);

      for (let j = 0; j < segments; j++) {
        const y = yOffset + height - (j + 1) * (segH + segGap);

        // Green-to-red styled duotone theme gradient
        let color = phosphorColor;
        if (j < 8) {
          color = phosphorDim;
        } else if (j >= 13) {
          color = phosphorBright;
        }

        const isActive = j < activeSegs;
        const isPeak = j === peakIdx;

        if (isActive || isPeak) {
          ctx.fillStyle = color;
          ctx.globalAlpha = isPeak ? 0.95 : (0.7 + (j / segments) * 0.25);
          ctx.fillRect(x, y, colW, segH);
        } else {
          // Subtle inactive grid
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.05;
          ctx.fillRect(x, y, colW, segH);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // ========== Draw: LISSAJOUS Vector Scope ==========
  function drawLissajous(yOffset, height) {
    if (!timeData) return;

    const len = timeData.length;
    const half = Math.floor(len / 2);
    const cx = W / 2;
    const cy = yOffset + height / 2;
    const radius = Math.min(W, height) * 0.38;

    const points = [];
    const time = performance.now() * 0.001;
    const phaseShift = time * 0.55;

    for (let i = 0; i < half; i++) {
      const xVal = (timeData[i] - 128) / 128;
      const yVal = (timeData[i + half] - 128) / 128;

      const rotX = xVal * Math.cos(phaseShift) - yVal * Math.sin(phaseShift);
      const rotY = xVal * Math.sin(phaseShift) + yVal * Math.cos(phaseShift);

      points.push({
        x: cx + rotX * radius,
        y: cy + rotY * radius
      });
    }

    // Glow pass
    ctx.strokeStyle = phosphorDim;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();

    // Core pass
    ctx.strokeStyle = phosphorBright;
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();
  }

  // ========== Draw: WATERFALL scrolling spectrogram ==========
  function drawWaterfall(yOffset, height) {
    if (!freqData) return;

    // Scroll canvas contents downward using hardware-accelerated copy
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const srcY = yOffset * DPR;
    const destY = (yOffset + 2) * DPR;
    const copyH = (height - 2) * DPR;
    ctx.drawImage(viz, 0, srcY, W * DPR, copyH, 0, destY, W * DPR, copyH);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    // Clear the top row
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, yOffset, W, 2.5);

    // Draw new frequency row
    const len = freqData.length;
    const sliceW = W / len;

    for (let i = 0; i < len; i++) {
      const val = freqData[i] / 255;
      if (val > 0.05) {
        let color = phosphorDim;
        if (val > 0.8) {
          color = phosphorBright;
        } else if (val > 0.35) {
          color = phosphorColor;
        }
        ctx.fillStyle = color;
        ctx.globalAlpha = val * 0.9;
        ctx.fillRect(i * sliceW, yOffset + 0.5, sliceW + 0.5, 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ========== Draw: SONAR radial radar sweep ==========
  function drawSonar(yOffset, height, dt) {
    if (!freqData) return;

    const cx = W / 2;
    const cy = yOffset + height / 2;
    const radius = Math.min(W, height) * 0.46;

    // Increment sweep beam angle
    sonarAngle = (sonarAngle + (dt > 0 ? dt : 16) * 0.0012) % (Math.PI * 2);

    // Draw radial radar targets grid
    ctx.strokeStyle = phosphorDim;
    ctx.lineWidth = 1;

    const circles = [0.35, 0.7, 1.0];
    circles.forEach((pct) => {
      ctx.globalAlpha = pct === 1.0 ? 0.25 : 0.12;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * pct, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Crosshairs
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy);
    ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius);
    ctx.stroke();

    // Draw perpendicular frequency blips along the sweep line
    const len = freqData.length;
    const step = radius / len;

    ctx.lineWidth = 2;
    for (let i = 0; i < len; i++) {
      const val = freqData[i] / 255;
      if (val > 0.08) {
        const dist = i * step;

        const bx = cx + Math.cos(sonarAngle) * dist;
        const by = cy + Math.sin(sonarAngle) * dist;

        const perpX = Math.cos(sonarAngle + Math.PI / 2);
        const perpY = Math.sin(sonarAngle + Math.PI / 2);

        const h = val * 24;

        ctx.strokeStyle = val > 0.8 ? phosphorBright : (val > 0.45 ? phosphorColor : phosphorDim);
        ctx.globalAlpha = val * 0.85;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + perpX * h, by + perpY * h);
        ctx.stroke();
      }
    }

    // Draw the sweeping radar hand
    const beamCos = Math.cos(sonarAngle);
    const beamSin = Math.sin(sonarAngle);

    const grad = ctx.createLinearGradient(cx, cy, cx + beamCos * radius, cy + beamSin * radius);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.85, phosphorDim);
    grad.addColorStop(1, phosphorBright);

    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + beamCos * radius, cy + beamSin * radius);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ========== Draw: RIPPLES pulsing concentric rings ==========
  function drawRipples(yOffset, height) {
    if (!freqData) return;

    const cx = W / 2;
    const cy = yOffset + height / 2;
    const maxR = Math.min(W, height) * 0.48;

    const rings = [
      { startPct: 0.15, maxPct: 0.38, startBin: 0,   endBin: 6,   glow: phosphorBright, dim: phosphorColor, weight: 1.5 },
      { startPct: 0.42, maxPct: 0.68, startBin: 6,   endBin: 24,  glow: phosphorColor,  dim: phosphorDim,   weight: 1.0 },
      { startPct: 0.72, maxPct: 0.95, startBin: 24,  endBin: 64,  glow: phosphorColor,  dim: phosphorDim,   weight: 0.8 }
    ];

    const vertices = 48;
    const time = performance.now() * 0.001;

    rings.forEach((r) => {
      const level = avg(freqData, r.startBin, r.endBin) / 255;
      const baseRadius = maxR * r.startPct + level * maxR * (r.maxPct - r.startPct) * 0.25;

      const points = [];
      for (let v = 0; v < vertices; v++) {
        const theta = (v / vertices) * Math.PI * 2;
        const binIdx = r.startBin + Math.floor((v / vertices) * (r.endBin - r.startBin));
        const val = freqData[binIdx] / 255;

        const ripple = Math.sin(theta * 6 + time * 4) * (val * 16);
        const radius = baseRadius + ripple;

        points.push({
          x: cx + Math.cos(theta) * radius,
          y: cy + Math.sin(theta) * radius
        });
      }

      // Glow pass
      ctx.strokeStyle = r.dim;
      ctx.globalAlpha = 0.35 + level * 0.25;
      ctx.lineWidth = r.weight * 3.5;
      ctx.beginPath();
      points.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.stroke();

      // Core pass
      ctx.strokeStyle = r.glow;
      ctx.globalAlpha = 0.7 + level * 0.3;
      ctx.lineWidth = r.weight;
      ctx.beginPath();
      points.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.stroke();
    });

    ctx.globalAlpha = 1;
  }

  // ========== Draw: WARP starfield (spaceship traveling through stars) ==========
  function drawWarp(yOffset, height, dt) {
    const cx = W / 2;
    const cy = yOffset + height / 2;
    const focal = height * 0.8;
    const maxZ = 1000;

    if (!warpInited || warpStars.length !== WARP_STARS) {
      warpStars = [];
      for (let i = 0; i < WARP_STARS; i++) {
        warpStars.push({
          x: (Math.random() - 0.5) * 2000,
          y: (Math.random() - 0.5) * 2000,
          z: Math.random() * maxZ,
          px: 0, py: 0
        });
      }
      warpInited = true;
    }

    // Audio-reactive warp speed: base + bass-driven boost
    const targetSpeed = 0.5 + bassS * 12 + levelS * 4;
    warpSpeed += (targetSpeed - warpSpeed) * 0.15;

    const dz = warpSpeed * (dt > 0 ? dt : 16) * 0.06;

    // Persistence: lighter trail for longer streaks
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(0, yOffset, W, height);

    for (let i = 0; i < warpStars.length; i++) {
      const s = warpStars[i];
      const zPrev = s.z;
      s.z -= dz;

      // Reset star when it passes the camera
      if (s.z <= 1) {
        s.x = (Math.random() - 0.5) * 2000;
        s.y = (Math.random() - 0.5) * 2000;
        s.z = maxZ;
        continue;
      }

      // Project 3D to 2D
      const sx = (s.x / s.z) * focal + cx;
      const sy = (s.y / s.z) * focal + cy;

      // Skip if off-screen
      if (sx < -10 || sx > W + 10 || sy < yOffset - 10 || sy > yOffset + height + 10) continue;

      // Previous position for streak
      const px = (s.x / zPrev) * focal + cx;
      const py = (s.y / zPrev) * focal + cy;

      // Depth-based brightness (closer = brighter)
      const depth = 1 - s.z / maxZ;
      const alpha = depth * depth;

      // Star size grows as it approaches
      const size = 0.5 + depth * 2.5;

      // Streak from previous to current position
      ctx.strokeStyle = depth > 0.7 ? phosphorBright : (depth > 0.4 ? phosphorColor : phosphorDim);
      ctx.globalAlpha = alpha;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.stroke();

      // Bright dot at star head when close enough
      if (depth > 0.5) {
        ctx.fillStyle = phosphorBright;
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillRect(sx - size * 0.5, sy - size * 0.5, size, size);
      }
    }

    // Crosshair / HUD overlay
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = phosphorDim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy); ctx.lineTo(cx - 5, cy);
    ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 15, cy);
    ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy - 5);
    ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + 15);
    ctx.stroke();

    // Speed readout
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = phosphorColor;
    ctx.font = "11px 'VT323', 'IBM Plex Mono', monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("WARP " + (warpSpeed * 10).toFixed(1), 6, yOffset + 4);
    ctx.textAlign = "right";
    ctx.fillText(freqData ? Math.round(levelS * 100) + "%" : "0%", W - 6, yOffset + 4);

    ctx.globalAlpha = 1;
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  // ========== Draw: HORIZON (3D frequency terrain) ==========
  function drawHorizon(yOffset, height) {
    const cx = W / 2;
    const horizonY = yOffset + height * 0.25;
    const maxMountainH = height * 0.55;

    // Push current frequency snapshot into history ring buffer
    if (!freqData) return;
    const total = freqData.length;
    const snapshot = new Array(HORIZON_BINS);
    for (let i = 0; i < HORIZON_BINS; i++) {
      const range = logBin(i, HORIZON_BINS, total);
      snapshot[i] = avg(freqData, range.start, range.end) / 255;
    }
    horizonHistory.unshift(snapshot);
    if (horizonHistory.length > HORIZON_ROWS) horizonHistory.pop();

    // Light persistence for trail effect
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(0, yOffset, W, height);

    const rowSpacing = height / HORIZON_ROWS;

    // Draw terrain rows from far (top) to near (bottom)
    for (let row = horizonHistory.length - 1; row >= 0; row--) {
      const data = horizonHistory[row];
      const z = row / HORIZON_ROWS; // 0=near, 1=far
      const rowY = horizonY + z * height * 0.7;
      const perspectiveScale = 1 - z * 0.7;
      const halfW = W * 0.5 * perspectiveScale;
      const leftX = cx - halfW;
      const rightX = cx + halfW;
      const colW = (rightX - leftX) / (HORIZON_BINS - 1);

      const depth = 1 - z;
      const alpha = depth * 0.85;
      const color = depth > 0.6 ? phosphorBright : (depth > 0.3 ? phosphorColor : phosphorDim);

      // Fill the terrain band from this row down to the next row
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha * 0.15;
      ctx.beginPath();
      ctx.moveTo(leftX, rowY);
      for (let i = 0; i < HORIZON_BINS; i++) {
        const peakH = data[i] * maxMountainH * perspectiveScale;
        ctx.lineTo(leftX + i * colW, rowY - peakH);
      }
      // Close along the row baseline
      ctx.lineTo(rightX, rowY);
      ctx.closePath();
      ctx.fill();

      // Draw the ridge line
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = depth > 0.5 ? 1.5 : 1;
      ctx.beginPath();
      for (let i = 0; i < HORIZON_BINS; i++) {
        const peakH = data[i] * maxMountainH * perspectiveScale;
        const px = leftX + i * colW;
        const py = rowY - peakH;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // HUD labels
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = phosphorColor;
    ctx.font = "11px 'VT323', 'IBM Plex Mono', monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("TERRAIN SCAN", 6, yOffset + 4);
    ctx.textAlign = "right";
    ctx.fillText("ROWS " + horizonHistory.length, W - 6, yOffset + 4);

    ctx.globalAlpha = 1;
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  // ========== Draw: PARTICLES (audio-reactive particle field) ==========
  function drawParticles(yOffset, height, dt) {
    const cx = W / 2;
    const cy = yOffset + height / 2;
    const maxR = Math.min(W, height) * 0.48;

    if (!particlesInited || particles.length !== PARTICLE_COUNT) {
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * maxR;
        particles.push({
          x: cx + Math.cos(a) * r,
          y: cy + Math.sin(a) * r,
          vx: 0, vy: 0,
          size: 1.5 + Math.random() * 2
        });
      }
      particlesInited = true;
    }

    const bassForce = bassS * 8;
    const trebJitter = trebS * 1.5;
    const dts = (dt > 0 ? dt : 16) * 0.06;

    // Light persistence for trails
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.fillRect(0, yOffset, W, height);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Direction from center
      const dx = p.x - cx, dy = p.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) + 1;
      const nx = dx / dist, ny = dy / dist;

      // Bass pushes outward
      p.vx += nx * bassForce * dts;
      p.vy += ny * bassForce * dts;

      // Gentle pull back to center
      p.vx -= nx * 1.2 * dts;
      p.vy -= ny * 1.2 * dts;

      // Treble jitter
      p.vx += (Math.random() - 0.5) * trebJitter * dts * 6;
      p.vy += (Math.random() - 0.5) * trebJitter * dts * 6;

      // Damping
      p.vx *= 0.92;
      p.vy *= 0.92;

      p.x += p.vx * dts * 4;
      p.y += p.vy * dts * 4;

      // Wrap around edges
      if (p.x < yOffset) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < yOffset) p.y = yOffset + height;
      if (p.y > yOffset + height) p.y = yOffset;

      // Distance from center determines brightness
      const normDist = dist / maxR;
      const energy = 0.3 + bassS * 0.7 + levelS * 0.3;
      const alpha = Math.min(1, (0.3 + normDist * 0.5) * energy);
      const sz = p.size * (1 + bassS * 2);

      // Glow
      ctx.fillStyle = phosphorDim;
      ctx.globalAlpha = alpha * 0.3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, sz * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = normDist > 0.6 ? phosphorBright : phosphorColor;
      ctx.globalAlpha = alpha;
      ctx.fillRect(p.x - sz * 0.5, p.y - sz * 0.5, sz, sz);
    }

    // HUD
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = phosphorColor;
    ctx.font = "11px 'VT323', 'IBM Plex Mono', monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("PARTICLES " + PARTICLE_COUNT, 6, yOffset + 4);
    ctx.textAlign = "right";
    ctx.fillText("BASS " + Math.round(bassS * 100) + "%", W - 6, yOffset + 4);

    ctx.globalAlpha = 1;
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  // ========== Draw: RADAR (circular oscilloscope) ==========
  function drawRadar(yOffset, height) {
    if (!timeData) return;

    const cx = W / 2;
    const cy = yOffset + height / 2;
    const radius = Math.min(W, height) * 0.42;
    const len = timeData.length;
    const time = performance.now() * 0.001;

    // Slow rotation for the whole pattern
    radarRotation += 0.003;
    const rot = radarRotation;

    // Persistence
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(0, yOffset, W, height);

    // Concentric range rings
    ctx.strokeStyle = phosphorDim;
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      ctx.globalAlpha = 0.1 + (i === 4 ? 0.05 : 0);
      ctx.beginPath();
      ctx.arc(cx, cy, radius * (i / 4), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Crosshairs
    ctx.globalAlpha = 0.1;
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy);
    ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius);
    ctx.stroke();

    // Draw the waveform as a closed radial curve
    // Each sample maps to an angle around the circle, amplitude modulates radius
    const points = [];
    for (let i = 0; i < len; i++) {
      const angle = (i / len) * Math.PI * 2 + rot;
      const v = (timeData[i] - 128) / 128;
      const r = radius * (0.5 + v * 0.4);
      points.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r
      });
    }

    // Glow pass
    ctx.strokeStyle = phosphorDim;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 4;
    ctx.beginPath();
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();

    // Core pass
    ctx.strokeStyle = phosphorBright;
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();

    // Sweep line (like sonar but on the circular scope)
    const sweepAngle = (time * 0.8) % (Math.PI * 2);
    const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(sweepAngle) * radius, cy + Math.sin(sweepAngle) * radius);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.8, phosphorDim);
    grad.addColorStop(1, phosphorBright);
    ctx.strokeStyle = grad;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAngle) * radius, cy + Math.sin(sweepAngle) * radius);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = phosphorColor;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();

    // HUD
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = phosphorColor;
    ctx.font = "11px 'VT323', 'IBM Plex Mono', monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("RADAR SCOPE", 6, yOffset + 4);
    ctx.textAlign = "right";
    ctx.fillText("CH-1", W - 6, yOffset + 4);

    ctx.globalAlpha = 1;
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  // ========== Draw: phosphor persistence (afterglow) ==========
  function drawPersistence() {
    // Instead of fully clearing, overlay a translucent black to create ghost trails
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(0, 0, W, H);
  }

  // ========== Render loop ==========
  function draw(now) {
    rafId = requestAnimationFrame(draw);

    // Don't render before layout
    if (W <= 0 || H <= 0) return;

    // CRT channel-switch effect takes over the screen
    if (channelSwitchUntil && now < channelSwitchUntil) {
      if (now - lastFrame < 33) return; // cap at ~30fps
      lastFrame = now;
      drawChannelSwitch(now);
      return;
    } else if (channelSwitchUntil) {
      channelSwitchUntil = 0;
    }

    // Adaptive frame rate
    const vizMode = VIZ_MODES[vizIdx];
    let frameMS = 1000 / PERF_LEVELS[perfIdx].fps;
    if (vizMode === "OFF") {
      frameMS = Math.max(frameMS, FRAME_MS_OFF);
    } else if (silentFrames > 30) {
      frameMS = Math.max(frameMS, FRAME_MS_IDLE);
    }

    if (now - lastFrame < frameMS) return;
    lastFrame = now;
    const dt = prevDraw ? Math.min(100, now - prevDraw) : 16;
    prevDraw = now;

    // Read audio data
    let bass = 0, mid = 0, treb = 0, level = 0;
    if (analyser) {
      analyser.getByteFrequencyData(freqData);
      if (vizMode === "SCOPE" || vizMode === "VU" || vizMode === "LISSAJOUS" || vizMode === "RADAR") {
        analyser.getByteTimeDomainData(timeData);
      }
      bass  = avg(freqData, 0, 4) / 255;
      mid   = avg(freqData, 4, 20) / 255;
      treb  = avg(freqData, 20, 48) / 255;
      level = avg(freqData, 0, freqData.length) / 255;
    }

    bassS  += (bass  - bassS)  * 0.25;
    midS   += (mid   - midS)   * 0.20;
    trebS  += (treb  - trebS)  * 0.20;
    levelS += (level - levelS) * 0.15;

    // Track silence for adaptive framerate
    if (levelS < 0.01) silentFrames++;
    else silentFrames = 0;

    // Audio-reactive screen brightness (only update on meaningful change)
    const brightness = 0.95 + levelS * 0.1;
    if (Math.abs(brightness - lastBrightness) > 0.01) {
      screen.style.setProperty("--crt-brightness", brightness);
      lastBrightness = brightness;
    }

    // Update VU needle physics
    if (vizMode === "VU") {
      let peakL = 0, peakR = 0;
      if (timeData && analyser) {
        const half = Math.floor(timeData.length / 2);
        for (let i = 0; i < half; i++) {
          const val = Math.abs(timeData[i] - 128) / 128;
          if (val > peakL) peakL = val;
        }
        for (let i = half; i < timeData.length; i++) {
          const val = Math.abs(timeData[i] - 128) / 128;
          if (val > peakR) peakR = val;
        }
      }
      const forceL = (peakL - vuL) * 0.8;
      vuLVel += forceL;
      vuLVel *= 0.65;
      vuL += vuLVel;
      vuL = clamp(vuL, 0, 1.15);

      const forceR = (peakR - vuR) * 0.8;
      vuRVel += forceR;
      vuRVel *= 0.65;
      vuR += vuRVel;
      vuR = clamp(vuR, 0, 1.15);
    }

    // --- Rendering ---
    if (vizMode === "OFF") {
      // Static graticule only
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      if (gridCanvas && gridCanvas.width > 0 && gridCanvas.height > 0) {
        ctx.drawImage(gridCanvas, 0, 0, gridCanvas.width, gridCanvas.height, 0, 0, W, H);
      }
      return;
    }

    // Phosphor persistence (bypass for modes that do their own trail rendering)
    if (vizMode !== "WATERFALL" && vizMode !== "WARP" && vizMode !== "HORIZON" && vizMode !== "PARTICLES" && vizMode !== "RADAR") {
      drawPersistence();
    }

    // Stamp cached graticule
    if (gridCanvas && gridCanvas.width > 0 && gridCanvas.height > 0) {
      ctx.drawImage(gridCanvas, 0, 0, gridCanvas.width, gridCanvas.height, 0, 0, W, H);
    }

    // Draw active visualization
    switch (vizMode) {
      case "SCOPE":
        drawScope(0, H);
        break;
      case "BARS":
        drawBars(0, H);
        break;
      case "VU":
        drawVU(0, H);
        break;
      case "LEDS":
        drawLEDs(0, H, dt);
        break;
      case "LISSAJOUS":
        drawLissajous(0, H);
        break;
      case "WATERFALL":
        drawWaterfall(0, H);
        break;
      case "SONAR":
        drawSonar(0, H, dt);
        break;
      case "RIPPLES":
        drawRipples(0, H);
        break;
      case "WARP":
        drawWarp(0, H, dt);
        break;
      case "HORIZON":
        drawHorizon(0, H);
        break;
      case "PARTICLES":
        drawParticles(0, H, dt);
        break;
      case "RADAR":
        drawRadar(0, H);
        break;
    }

    // CORS-limited overlay — audio plays but analyser has no data
    if (vizLimited) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(0, H / 2 - 20, W, 40);
      ctx.fillStyle = phosphorDim;
      ctx.font = "14px 'VT323', 'IBM Plex Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("CORS LIMITED — AUDIO ONLY", W / 2, H / 2);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    }
  }

  function startLoop() {
    if (!rafId) rafId = requestAnimationFrame(draw);
  }
  function stopLoop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; prevDraw = 0; }
  }

  // ========== "NO SIGNAL" idle rendering ==========
  let idleRafId = 0;
  let idleActive = false;
  function drawIdle(now) {
    idleRafId = requestAnimationFrame(drawIdle);
    if (W <= 0 || H <= 0) return;
    if (now - lastFrame < FRAME_MS_IDLE) return;
    lastFrame = now;
    drawNoise();
  }
  function startIdle() {
    idleActive = true;
    if (!idleRafId) idleRafId = requestAnimationFrame(drawIdle);
  }
  function stopIdle() {
    idleActive = false;
    if (idleRafId) { cancelAnimationFrame(idleRafId); idleRafId = 0; }
  }

  // ========== CRT channel-switch effect ==========
  // Classic old-TV channel change: static burst + horizontal sync loss + vertical roll
  // Drawn inside the main draw() loop via a timestamp flag — no separate rAF
  function triggerChannelSwitch() {
    channelSwitchUntil = performance.now() + CHANNEL_SWITCH_MS;
  }

  function drawChannelSwitch(now) {
    const remaining = channelSwitchUntil - now;
    if (remaining <= 0) return false;
    const elapsed = CHANNEL_SWITCH_MS - remaining;
    const t = Math.min(1, elapsed / CHANNEL_SWITCH_MS); // 0 → 1

    // Phase 1 (0-0.2): static burst
    // Phase 2 (0.2-0.55): noise with horizontal sync tearing
    // Phase 3 (0.55-0.8): vertical roll stabilizing
    // Phase 4 (0.8-1.0): sync bar sweeps down, signal locks in

    // Black background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    // Noise intensity: moderate at start, fades through phases
    let noiseLevel;
    if (t < 0.2) noiseLevel = 0.5;
    else if (t < 0.55) noiseLevel = 0.5 - (t - 0.2) / 0.35 * 0.3;
    else if (t < 0.8) noiseLevel = 0.2 - (t - 0.55) / 0.25 * 0.15;
    else noiseLevel = 0.05 - (t - 0.8) / 0.2 * 0.05;

    if (noiseLevel > 0.02) {
      const d = noiseImageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255 * noiseLevel) | 0;
        d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
      }
      noiseCtx.putImageData(noiseImageData, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(noiseCanvas, 0, 0, W, H);
      ctx.imageSmoothingEnabled = true;
    }

    // Horizontal sync tearing — displaced strips
    if (t < 0.5) {
      const tearIntensity = 1 - t / 0.5;
      const numStrips = 12;
      const stripH = H / numStrips;
      for (let i = 0; i < numStrips; i++) {
        if (Math.random() < 0.5 * tearIntensity) {
          const offset = (Math.random() - 0.5) * W * 0.5 * tearIntensity;
          const sy = (i / numStrips) * NOISE_H;
          const sh = NOISE_H / numStrips;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(noiseCanvas, 0, sy, NOISE_W, sh, offset, i * stripH, W, stripH + 1);
        }
      }
    }

    // Vertical roll — whole image jumps, stabilizing
    if (t > 0.3 && t < 0.85) {
      const rollPhase = (t - 0.3) / 0.55;
      const rollAmount = Math.sin(rollPhase * Math.PI * 2.5) * H * 0.12 * (1 - rollPhase);
      if (Math.abs(rollAmount) > 2) {
        // Re-draw noise shifted vertically
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
        ctx.imageSmoothingEnabled = false;
        const srcY = rollAmount > 0 ? 0 : -rollAmount / H * NOISE_H;
        ctx.drawImage(noiseCanvas, 0, srcY, NOISE_W, NOISE_H, 0, rollAmount, W, H);
        ctx.imageSmoothingEnabled = true;
      }
    }

    // Sync bar — dim horizontal band sweeping down (new signal locking)
    if (t > 0.6) {
      const barPhase = (t - 0.6) / 0.4;
      const barY = barPhase * H;
      const barH = 4 + (1 - barPhase) * 8;
      ctx.fillStyle = phosphorColor;
      ctx.globalAlpha = (1 - barPhase * 0.7) * 0.4;
      ctx.fillRect(0, barY - barH / 2, W, barH);
      ctx.globalAlpha = 1;
    }

    // Darkening overlay as signal locks in
    if (t > 0.75) {
      const fade = (t - 0.75) / 0.25;
      ctx.fillStyle = `rgba(0, 0, 0, ${fade * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }

    return true;
  }

  // ========== Audio graph ==========
  function ensureGraph() {
    if (actx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    actx = new AC();
    gainNode = actx.createGain();
    gainNode.gain.value = parseFloat(volEl.value);
    analyser = actx.createAnalyser();
    analyser.fftSize = PERF_LEVELS[perfIdx].fft;
    analyser.smoothingTimeConstant = 0.80;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);
    analyser.connect(gainNode);
    gainNode.connect(actx.destination);
  }

  function ensureFileSource() {
    ensureGraph();
    if (!fileSource) {
      fileSource = actx.createMediaElementSource(audio);
      fileSource.connect(analyser);
    }
  }
  function ensureRadioSource() {
    ensureGraph();
    if (!radioSource) {
      radioEl.crossOrigin = "anonymous";
      radioSource = actx.createMediaElementSource(radioEl);
      radioSource.connect(analyser);
    }
  }

  // ========== CRT power-on effect ==========
  function triggerCRTOn() {
    screen.classList.remove("crt-on");
    // Force reflow to restart animation
    void screen.offsetWidth;
    screen.classList.add("crt-on");
  }

  // ========== File loading ==========
  function loadFiles(files) {
    if (!files || files.length === 0) return;
    const valid = [];
    for (const f of files) {
      const okType = f.type && f.type.startsWith("audio");
      const okExt  = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|weba|webm)$/i.test(f.name);
      if (okType || okExt) valid.push(f);
    }
    if (valid.length === 0) return;
    queue = valid;
    loadQueueItem(0);
  }

  function loadQueueItem(idx) {
    const file = queue[idx];
    if (!file) return;
    queueIdx = idx;

    if (radioEl) radioEl.pause();
    if (directEl) { directEl.pause(); directEl.src = ""; }
    vizLimited = false;
    currentStation = null;
    clearActiveStation();
    stopMetadata();

    if (currentURL) URL.revokeObjectURL(currentURL);
    currentURL = URL.createObjectURL(file);

    if (!audio) {
      audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.preload = "auto";
      wireAudioEvents();
    }
    audio.src = currentURL;
    mode = "file";
    const displayName = baseName(file.name);
    updateNowPlayingText("", displayName);
    seek.disabled = false;
    showPlayer();
    ensureFileSource();
    if (actx.state === "suspended") actx.resume();
    setStatus(true, "PLAYING");
    triggerChannelSwitch();
    startHistoryEntry("file", displayName, null, null);
    audio.play().catch(() => setStatus(false, "READY"));
    stopIdle();
    startLoop();
    renderQueue();
    updateTrackCount();
    updateLikeBtn();
  }

  function nextTrack() {
    if (mode !== "file" || queue.length === 0) return;
    if (queueIdx < queue.length - 1) loadQueueItem(queueIdx + 1);
    else if (repeatMode === 1) loadQueueItem(0); // repeat-all: loop to start
  }

  function prevTrack() {
    if (mode !== "file" || queue.length === 0) return;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
    } else if (queueIdx > 0) {
      loadQueueItem(queueIdx - 1);
    } else {
      if (audio) audio.currentTime = 0;
    }
  }

  function updateTrackCount() {
    if (mode === "file" && queue.length > 1) {
      trackCountEl.textContent = (queueIdx + 1) + "/" + queue.length;
    } else {
      trackCountEl.textContent = "";
    }
  }

  function wireAudioEvents() {
    audio.addEventListener("loadedmetadata", () => {
      durEl.textContent = fmt(audio.duration);
      seek.max = 1000;
      if (mode === "file") updateHudTracks();
    });
    audio.addEventListener("timeupdate", () => {
      curEl.textContent = fmt(audio.currentTime);
      if (!seekDragging) seek.value = audio.duration ? (audio.currentTime / audio.duration) * 1000 : 0;
    });
    audio.addEventListener("ended",  () => {
      if (repeatMode === 2) { audio.currentTime = 0; audio.play(); return; } // repeat-one
      finalizeHistoryEntry("completed");
      if (queueIdx < queue.length - 1) loadQueueItem(queueIdx + 1);
      else if (repeatMode === 1) loadQueueItem(0); // repeat-all: loop
      else { setPlaying(false); setStatus(false, "ENDED"); stopLoop(); startIdle(); }
    });
    audio.addEventListener("error",  () => {
      finalizeHistoryEntry("error");
      if (queueIdx < queue.length - 1) loadQueueItem(queueIdx + 1);
      else { setStatus(false, "ERROR"); stopLoop(); startIdle(); }
    });
    audio.addEventListener("play",   () => { setPlaying(true);  setStatus(true, "PLAYING"); stopIdle(); startLoop(); });
    audio.addEventListener("pause",  () => { setPlaying(false); setStatus(false, "PAUSED"); stopTextToggler(); });
  }

  // ========== Radio ==========
  const STATIONS = [
    { name: "SOMAFM · DEEP SPACE ONE",  channel: "deepspaceone",    url: "https://ice.somafm.com/deepspaceone-128-mp3" },
    { name: "SOMAFM · MISSION CONTROL", channel: "missioncontrol",  url: "https://ice.somafm.com/missioncontrol-128-mp3" },
    { name: "SOMAFM · THE TRIP",        channel: "thetrip",         url: "https://ice.somafm.com/thetrip-128-mp3" },
    { name: "SOMAFM · GROOVE SALAD",    channel: "groovesalad",     url: "https://ice.somafm.com/groovesalad-128-mp3" },
    { name: "SOMAFM · DRONE ZONE",      channel: "dronezone",       url: "https://ice.somafm.com/dronezone-128-mp3" },
    { name: "SOMAFM · SECRET AGENT",    channel: "secretagent",     url: "https://ice.somafm.com/secretagent-128-mp3" },
    { name: "SOMAFM · SONIC UNIVERSE",  channel: "sonicuniverse",   url: "https://ice.somafm.com/sonicuniverse-128-mp3" },
    { name: "SOMAFM · BEAT BLENDER",    channel: "beatblender",     url: "https://ice.somafm.com/beatblender-128-mp3" },
    { name: "SOMAFM · SPACE STATION",   channel: "spacestation",    url: "https://ice.somafm.com/spacestation-128-mp3" },
    { name: "SOMAFM · DEF CON RADIO",   channel: "defcon",          url: "https://ice.somafm.com/defcon-128-mp3" },
    { name: "SOMAFM · SUBURBS OF GOA",  channel: "suburbsofgoa",    url: "https://ice.somafm.com/suburbs-128-mp3" },
    { name: "SOMAFM · u80s",            channel: "u80s",            url: "https://ice.somafm.com/u80s-128-mp3" },
  ];

  // ========== Favourites ==========
  function loadFavourites() {
    try {
      const raw = localStorage.getItem("phosphor-favourites");
      favourites = raw ? JSON.parse(raw) : [];
    } catch (e) { favourites = []; }
  }
  function saveFavourites() {
    localStorage.setItem("phosphor-favourites", JSON.stringify(favourites));
  }
  function isFavourite(url) {
    return favourites.some((f) => f.url === url);
  }
  function toggleFavourite(name, url, channel) {
    const idx = favourites.findIndex((f) => f.url === url);
    if (idx >= 0) {
      favourites.splice(idx, 1);
    } else {
      favourites.push({ name, url, channel: channel || null });
    }
    saveFavourites();
    buildStations();
  }

  function toggleCurrentFavourite() {
    if (currentStation && mode === "radio") {
      toggleFavourite(currentStation.name, currentStation.url, currentStation.channel);
    }
  }

  // ========== History ==========
  function loadHistory() {
    try {
      const raw = localStorage.getItem("phosphor-history");
      history = raw ? JSON.parse(raw) : [];
    } catch (e) { history = []; }
    try {
      const raw2 = localStorage.getItem("phosphor-liked");
      likedTracks = raw2 ? JSON.parse(raw2) : [];
    } catch (e) { likedTracks = []; }
  }
  function saveHistory() {
    try { localStorage.setItem("phosphor-history", JSON.stringify(history)); } catch (e) {}
  }
  function saveLiked() {
    try { localStorage.setItem("phosphor-liked", JSON.stringify(likedTracks)); } catch (e) {}
  }

  function startHistoryEntry(type, title, station, track) {
    finalizeHistoryEntry("skipped");
    const entry = {
      type: type,
      title: title,
      station: station || null,
      track: track || null,
      startedAt: Date.now(),
      endedAt: null,
      playDuration: 0,
      endReason: null
    };
    currentHistoryEntry = entry;
  }

  function finalizeHistoryEntry(reason) {
    if (!currentHistoryEntry) return;
    currentHistoryEntry.endedAt = Date.now();
    currentHistoryEntry.playDuration = Math.round((currentHistoryEntry.endedAt - currentHistoryEntry.startedAt) / 1000);
    currentHistoryEntry.endReason = reason;
    // Update track title for radio entries if metadata arrived after start
    if (currentHistoryEntry.type === "radio" && currentTrackTitle && currentTrackTitle !== currentStationTitle) {
      currentHistoryEntry.track = currentTrackTitle;
      currentHistoryEntry.title = currentStationTitle + " — " + currentTrackTitle;
    }
    history.unshift(currentHistoryEntry);
    if (history.length > HISTORY_MAX) history.length = HISTORY_MAX;
    saveHistory();
    currentHistoryEntry = null;
    if (historyPanel && !historyPanel.classList.contains("hidden") && historyTab === "history") renderHistory();
  }

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const s = Math.floor(diff / 1000);
    if (s < 60) return s + "s ago";
    const m = Math.floor(s / 60);
    if (m < 60) return m + "m ago";
    const h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    const d = Math.floor(h / 24);
    return d + "d ago";
  }

  function fmtDuration(sec) {
    if (sec < 60) return sec + "s";
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + "m" + (s < 10 ? "0" : "") + s + "s";
  }

  function renderHistory() {
    if (!histList) return;
    histList.innerHTML = "";
    if (history.length === 0) {
      const empty = document.createElement("div");
      empty.className = "hist-empty";
      empty.textContent = "> NO HISTORY YET";
      histList.appendChild(empty);
      if (histFoot) histFoot.textContent = "PLAYBACK LOG APPEARS HERE";
      return;
    }
    history.forEach((e) => {
      const row = document.createElement("div");
      row.className = "hist-entry";

      const titleEl_ = document.createElement("div");
      titleEl_.className = "hist-entry-title";
      titleEl_.textContent = e.title;
      row.appendChild(titleEl_);

      const meta = document.createElement("div");
      meta.className = "hist-entry-meta";

      const time = document.createElement("span");
      time.className = "tag";
      time.textContent = timeAgo(e.startedAt);
      meta.appendChild(time);

      if (e.playDuration > 0) {
        const dur = document.createElement("span");
        dur.className = "tag";
        dur.textContent = fmtDuration(e.playDuration);
        meta.appendChild(dur);
      }

      if (e.endReason) {
        const reason = document.createElement("span");
        reason.className = "tag tag-" + e.endReason;
        const labels = { completed: "DONE", skipped: "SKIP", stopped: "STOP", error: "ERR" };
        reason.textContent = labels[e.endReason] || e.endReason.toUpperCase();
        meta.appendChild(reason);
      }

      if (e.type === "radio") {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = "RADIO";
        meta.appendChild(tag);
      }

      row.appendChild(meta);
      histList.appendChild(row);
    });
    if (histFoot) histFoot.textContent = history.length + " / " + HISTORY_MAX + " ENTRIES";
  }

  function renderLiked() {
    if (!histList) return;
    histList.innerHTML = "";
    if (likedTracks.length === 0) {
      const empty = document.createElement("div");
      empty.className = "hist-empty";
      empty.textContent = "> NO LIKED TRACKS YET";
      histList.appendChild(empty);
      if (histFoot) histFoot.textContent = "LIKE TRACKS WHILE RADIO IS PLAYING";
      return;
    }
    likedTracks.forEach((t) => {
      const row = document.createElement("div");
      row.className = "hist-entry";

      const titleEl_ = document.createElement("div");
      titleEl_.className = "hist-entry-title";
      titleEl_.textContent = t.track;
      row.appendChild(titleEl_);

      const meta = document.createElement("div");
      meta.className = "hist-entry-meta";

      const st = document.createElement("span");
      st.className = "tag";
      st.textContent = t.station;
      meta.appendChild(st);

      const time = document.createElement("span");
      time.className = "tag";
      time.textContent = timeAgo(t.likedAt);
      meta.appendChild(time);

      row.appendChild(meta);
      histList.appendChild(row);
    });
    if (histFoot) histFoot.textContent = likedTracks.length + " / " + LIKED_MAX + " LIKED";
  }

  function renderHistoryTab() {
    if (historyTab === "history") renderHistory();
    else renderLiked();
  }

  function showHistoryTab(tab) {
    historyTab = tab;
    if (tabHistory) tabHistory.classList.toggle("active", tab === "history");
    if (tabLiked) tabLiked.classList.toggle("active", tab === "liked");
    if (tabHistory) tabHistory.setAttribute("aria-pressed", tab === "history");
    if (tabLiked) tabLiked.setAttribute("aria-pressed", tab === "liked");
    renderHistoryTab();
  }

  // ========== Liked tracks ==========
  function isLikedTrack(track, station) {
    return likedTracks.some((t) => t.track === track && t.station === station);
  }
  function toggleLikeTrack() {
    if (mode !== "radio" || !currentTrackTitle || !currentStationTitle || currentTrackTitle === currentStationTitle) return;
    const idx = likedTracks.findIndex((t) => t.track === currentTrackTitle && t.station === currentStationTitle);
    if (idx >= 0) {
      likedTracks.splice(idx, 1);
      flashStatus("UNLIKED");
    } else {
      likedTracks.unshift({ track: currentTrackTitle, station: currentStationTitle, likedAt: Date.now() });
      if (likedTracks.length > LIKED_MAX) likedTracks.length = LIKED_MAX;
      flashStatus("LIKED: " + currentTrackTitle);
    }
    saveLiked();
    updateLikeBtn();
    if (historyPanel && !historyPanel.classList.contains("hidden") && historyTab === "liked") renderLiked();
  }
  function updateLikeBtn() {
    if (!likeBtn) return;
    const canLike = mode === "radio" && currentTrackTitle && currentStationTitle && currentTrackTitle !== currentStationTitle;
    if (!canLike) {
      likeBtn.classList.add("hidden");
      likeBtn.setAttribute("aria-hidden", "true");
      likeBtn.classList.remove("liked");
      return;
    }
    likeBtn.classList.remove("hidden");
    likeBtn.setAttribute("aria-hidden", "false");
    const liked = isLikedTrack(currentTrackTitle, currentStationTitle);
    setIcon(likeBtn, "i-heart");
    likeBtn.classList.toggle("liked", liked);
    likeBtn.setAttribute("aria-pressed", liked);
    likeBtn.title = liked ? "Unlike this track" : "Like this track";
  }

  function buildStations() {
    stList.innerHTML = "";

    // Build a combined list: favourites (including non-SomaFM) + SomaFM stations
    const somaURLs = STATIONS.map((s) => s.url);
    const extraFavs = favourites.filter((f) => !somaURLs.includes(f.url));
    const favSoma = STATIONS.filter((s) => isFavourite(s.url));
    const nonFavSoma = STATIONS.filter((s) => !isFavourite(s.url));

    const hasFavourites = extraFavs.length > 0 || favSoma.length > 0;

    // Render favourites first
    if (hasFavourites) {
      extraFavs.forEach((f) => stList.appendChild(makeStationRow(f.name, f.url, f.channel, true)));
      favSoma.forEach((s) => stList.appendChild(makeStationRow(s.name, s.url, s.channel, true)));
      const div = document.createElement("hr");
      div.className = "stations-divider";
      stList.appendChild(div);
    }
    // Then non-favourite SomaFM stations
    nonFavSoma.forEach((s) => stList.appendChild(makeStationRow(s.name, s.url, s.channel, false)));
  }

  function makeStationRow(name, url, channel, isFav) {
    const row = document.createElement("div");
    row.className = "station-row";

    const star = document.createElement("button");
    star.className = "star-btn" + (isFav ? " fav" : "");
    star.appendChild(createIcon("i-star"));
    star.title = isFav ? "Remove from favourites" : "Add to favourites";
    star.setAttribute("aria-label", star.title);
    star.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFavourite(name, url, channel);
    });

    const play = document.createElement("button");
    play.className = "station-name";
    play.textContent = name;
    play.addEventListener("click", () => {
      [...stList.querySelectorAll(".station-name")].forEach((c) => c.classList.remove("active"));
      play.classList.add("active");
      const corsExpected = !!channel;
      playStation(url, name, channel, corsExpected);
    });

    row.appendChild(star);
    row.appendChild(play);
    return row;
  }

  function playStation(url, name, channel, corsExpected) {
    hideStations();
    if (audio) audio.pause();
    if (directEl) { directEl.pause(); directEl.src = ""; }
    if (currentURL) { URL.revokeObjectURL(currentURL); currentURL = null; }

    vizLimited = false;
    currentStation = { name, url, channel };

    if (!radioEl) {
      radioEl = new Audio();
      radioEl.preload = "none";
      wireRadioEvents();
    }

    radioEl._pendingUrl = url;
    radioEl._pendingName = name;
    radioEl._pendingChannel = channel;
    radioEl._corsFallback = !corsExpected;

    radioEl.src = url;
    mode = "radio";
    updateNowPlayingText(name, "");
    seek.disabled = true;
    seek.value = 0;
    curEl.textContent = "LIVE";
    durEl.textContent = "LIVE";
    trackCountEl.textContent = "";
    showPlayer();
    ensureRadioSource();
    if (actx.state === "suspended") actx.resume();
    setStatus(true, "BUFFERING");
    triggerChannelSwitch();
    startHistoryEntry("radio", name, name, null);
    radioEl.play().then(() => setStatus(true, "LIVE")).catch(() => {
      if (radioEl._corsFallback) tryDirectFallback(url, name);
      else setStatus(false, "NO SIGNAL");
    });
    stopIdle();
    startLoop();
    startMetadata(channel);
    updateLikeBtn();
  }

  function tryDirectFallback(url, name) {
    if (!radioEl || !radioEl._corsFallback) return;
    radioEl._corsFallback = false;
    if (!directEl) {
      directEl = new Audio();
      directEl.preload = "none";
      wireDirectEvents();
    }
    if (radioEl) radioEl.pause();
    vizLimited = true;
    directEl.src = url;
    updateNowPlayingText(name, "");
    setStatus(true, "LIVE*");
    flashStatus("CORS LIMITED — AUDIO ONLY");
    directEl.play().catch(() => setStatus(false, "NO SIGNAL"));
  }

  function wireDirectEvents() {
    directEl.addEventListener("play",   () => {
      setPlaying(true);
      setStatus(true, "LIVE*");
      stopIdle();
      startLoop();
      if (mode === "radio" && currentStationTitle && currentTrackTitle && currentTrackTitle !== currentStationTitle) {
        runTypewriterCycle(0);
      }
    });
    directEl.addEventListener("pause",  () => {
      setPlaying(false);
      setStatus(false, "PAUSED");
      stopTextToggler();
      const displayElement = $("title");
      if (displayElement) {
        displayElement.textContent = currentTrackTitle || currentStationTitle || "—";
      }
    });
    directEl.addEventListener("waiting", () => setStatus(true, "BUFFERING"));
    directEl.addEventListener("error",  () => {
      finalizeHistoryEntry("error");
      setStatus(false, "NO SIGNAL");
      stopLoop();
      startIdle();
      stopTextToggler();
    });
    directEl.addEventListener("timeupdate", () => {
      if (mode === "radio" && vizLimited) { curEl.textContent = fmt(directEl.currentTime); durEl.textContent = "LIVE"; }
    });
  }

  function wireRadioEvents() {
    radioEl.addEventListener("play",    () => {
      if (vizLimited) return;
      setPlaying(true);
      setStatus(true, "LIVE");
      stopIdle();
      startLoop();
      if (mode === "radio" && currentStationTitle && currentTrackTitle && currentTrackTitle !== currentStationTitle) {
        runTypewriterCycle(0);
      }
    });
    radioEl.addEventListener("pause",   () => {
      if (vizLimited) return;
      setPlaying(false);
      setStatus(false, "PAUSED");
      stopTextToggler();
      const displayElement = $("title");
      if (displayElement) {
        displayElement.textContent = currentTrackTitle || currentStationTitle || "—";
      }
    });
    radioEl.addEventListener("waiting", () => { if (vizLimited) return; setStatus(true, "BUFFERING"); });
    radioEl.addEventListener("stalled", () => { if (vizLimited) return; setStatus(true, "BUFFERING"); });
    radioEl.addEventListener("error",   () => {
      if (radioEl._corsFallback) tryDirectFallback(radioEl._pendingUrl, radioEl._pendingName);
      else {
        finalizeHistoryEntry("error");
        setStatus(false, "NO SIGNAL");
        stopLoop();
        startIdle();
        stopMetadata();
        stopTextToggler();
      }
    });
    radioEl.addEventListener("timeupdate", () => {
      if (mode === "radio" && !vizLimited) { curEl.textContent = fmt(radioEl.currentTime); durEl.textContent = "LIVE"; }
    });
  }

  // ========== SomaFM now-playing metadata ==========
  function startMetadata(channel) {
    stopMetadata();
    if (!channel) return;
    const poll = async () => {
      try {
        const r = await fetch("https://somafm.com/songs/" + channel + ".json");
        if (!r.ok) return;
        const data = await r.json();
        if (mode !== "radio") return;
        if (!currentStation || currentStation.channel !== channel) return;
        const song = data.songs && data.songs[0];
        if (song && song.artist) {
          const trackTitle = song.artist + " — " + song.title;
          updateNowPlayingText(currentStation.name, trackTitle);
        }
      } catch (e) { /* network error — retry next cycle */ }
    };
    poll();
    metaTimer = setInterval(poll, 15000);
  }
  function stopMetadata() {
    if (metaTimer) { clearInterval(metaTimer); metaTimer = 0; }
  }

  // ========== RadioBrowser search ==========
  const RB_API = "https://de1.api.radio-browser.info/json/stations/search";
  let searchTimer = 0;

  function searchRadioBrowser(query) {
    const q = query.trim();
    if (q.length < 2) { renderSearchResults([]); return; }
    const url = RB_API + "?name=" + encodeURIComponent(q) + "&limit=20&order=votes&reverse=true&hidebroken=true";
    fetch(url)
      .then((r) => r.json())
      .then((stations) => renderSearchResults(stations))
      .catch(() => renderSearchResults(null));
  }

  function renderSearchResults(results) {
    const sr = $("searchResults");
    sr.innerHTML = "";
    if (results === null) {
      const msg = document.createElement("div");
      msg.className = "search-empty";
      msg.textContent = "> SEARCH ERROR";
      sr.appendChild(msg);
      return;
    }
    if (results.length === 0) {
      const msg = document.createElement("div");
      msg.className = "search-empty";
      msg.textContent = "> NO MATCHES";
      sr.appendChild(msg);
      return;
    }
    results.forEach((s) => {
      if (!s.url_resolved && !s.url) return;
      const streamUrl = s.url_resolved || s.url;
      const br = s.bitrate ? " " + s.bitrate + "k" : "";
      const displayName = s.name + br;
      const fav = isFavourite(streamUrl);

      const row = document.createElement("div");
      row.className = "station-row";

      const star = document.createElement("button");
      star.className = "star-btn" + (fav ? " fav" : "");
      star.appendChild(createIcon("i-star"));
      star.title = fav ? "Remove from favourites" : "Add to favourites";
      star.setAttribute("aria-label", star.title);
      star.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavourite(displayName, streamUrl, null);
      });

      const play = document.createElement("button");
      play.className = "station-name";
      play.textContent = displayName;
      play.title = s.country ? s.country : "";
      play.addEventListener("click", () => {
        [...sr.querySelectorAll(".station-name")].forEach((c) => c.classList.remove("active"));
        play.classList.add("active");
        playStation(streamUrl, s.name, null, false);
      });

      row.appendChild(star);
      row.appendChild(play);
      sr.appendChild(row);
    });
  }

  function hideStations() { stations.classList.add("hidden"); stations.setAttribute("aria-hidden", "true"); radioBtn.classList.remove("active-btn"); }
  function hideQueue() { queuePanel.classList.add("hidden"); queuePanel.setAttribute("aria-hidden", "true"); queueBtn.classList.remove("active-btn"); }
  function hideHistory() { historyPanel.classList.add("hidden"); historyPanel.setAttribute("aria-hidden", "true"); historyBtn.classList.remove("active-btn"); }
  function clearActiveStation() { [...stList.querySelectorAll(".station-name")].forEach((c) => c.classList.remove("active")); }
  function renderQueue() {
    qList.innerHTML = "";
    queue.forEach((f, i) => {
      const b = document.createElement("button");
      b.textContent = baseName(f.name);
      if (i === queueIdx) b.classList.add("active");
      b.addEventListener("click", () => loadQueueItem(i));
      qList.appendChild(b);
    });
  }

  // ========== UI helpers ==========
  function showPlayer() {
    drop.classList.add("hidden"); drop.setAttribute("aria-hidden", "true");
    player.classList.remove("hidden"); player.setAttribute("aria-hidden", "false");
    layout();
  }
  let seekDragging = false;
  let isPlayingState = false;
  function setPlaying(p) {
    isPlayingState = p;
    setIcon(playBtn, p ? "i-pause" : "i-play");
    playBtn.setAttribute("aria-label", p ? "Pause" : "Play");
  }
  function renderStatus() {
    led.classList.toggle("on", statusOn);
    statusTxt.textContent = statusText;
    if (hudState) hudState.textContent = statusText;
  }
  function setStatus(on, txt) {
    statusOn = on;
    statusText = txt;
    clearTimeout(flashTimer);
    renderStatus();
  }
  function flashStatus(msg) {
    clearTimeout(flashTimer);
    statusTxt.textContent = msg;
    flashTimer = setTimeout(renderStatus, 1400);
  }
  function togglePlay() {
    if (mode === "radio") {
      const el = vizLimited ? directEl : radioEl;
      if (!el) return;
      if (actx && !vizLimited && actx.state === "suspended") actx.resume();
      if (el.paused) el.play(); else el.pause();
    } else if (audio) {
      if (actx && actx.state === "suspended") actx.resume();
      if (audio.paused) audio.play(); else audio.pause();
    }
  }

  // ========== Drag & drop ==========
  ["dragenter", "dragover"].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); drop.classList.add("dragover"); })
  );
  ["dragleave", "dragend", "drop"].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); drop.classList.remove("dragover"); })
  );
  drop.addEventListener("drop", (e) => {
    e.stopPropagation();
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length > 0) loadFiles(files);
  });
  const openFileDialog = (input) => {
    if (fileDialogOpen) return;
    fileDialogOpen = true;
    input.click();
    setTimeout(() => { fileDialogOpen = false; }, 1000);
  };
  window.addEventListener("focus", () => { fileDialogOpen = false; });
  drop.addEventListener("click", () => { openFileDialog(fileIn); });
  drop.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFileDialog(fileIn); }
  });
  fileIn.addEventListener("change", () => {
    fileDialogOpen = false;
    if (fileIn.files.length > 0) loadFiles(fileIn.files);
    fileIn.value = "";
  });
  folderIn.addEventListener("change", () => {
    fileDialogOpen = false;
    if (folderIn.files.length > 0) loadFiles(folderIn.files);
    folderIn.value = "";
  });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length > 0) loadFiles(files);
  });

  // ========== Controls ==========
  playBtn.addEventListener("click", togglePlay);
  prevBtn.addEventListener("click", () => { prevTrack(); });
  nextBtn.addEventListener("click", () => { nextTrack(); });
  repeatBtn.addEventListener("click", () => {
    repeatMode = (repeatMode + 1) % 3;
    repeatBtn.classList.toggle("active-btn", repeatMode >= 1);
    repeatBtn.classList.toggle("repeat-one", repeatMode === 2);
    flashStatus(repeatMode === 0 ? "REPEAT: OFF" : repeatMode === 1 ? "REPEAT: ALL" : "REPEAT: ONE");
    localStorage.setItem("phosphor-repeat", repeatMode);
  });
  openBtn.addEventListener("click", () => { openFileDialog(fileIn); });
  folderBtn.addEventListener("click", () => { openFileDialog(folderIn); });
  const syncMuteBtn = (muted) => {
    setIcon(muteBtn, muted ? "i-mute" : "i-volume");
    muteBtn.setAttribute("aria-label", muted ? "Unmute" : "Mute");
    muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
  };
  muteBtn.addEventListener("click", () => {
    const el = (mode === "radio") ? (vizLimited ? directEl : radioEl) : audio;
    if (!el) return;
    el.muted = !el.muted;
    syncMuteBtn(el.muted);
  });
  volEl.addEventListener("input", () => {
    const v = parseFloat(volEl.value);
    if (gainNode) gainNode.gain.value = v;
    const muted = (v === 0);
    if (audio) audio.muted = muted;
    if (radioEl) radioEl.muted = muted;
    if (directEl) directEl.muted = muted;
    syncMuteBtn(muted);
    localStorage.setItem("phosphor-vol", v);
  });
  seek.addEventListener("pointerdown", () => { seekDragging = true; });
  seek.addEventListener("pointerup",   () => { seekDragging = false; });
  seek.addEventListener("input", () => {
    if (mode !== "file" || !audio || !audio.duration) return;
    audio.currentTime = (seek.value / 1000) * audio.duration;
  });

  radioBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    hideQueue();
    hideHistory();
    const hidden = stations.classList.toggle("hidden");
    stations.setAttribute("aria-hidden", hidden ? "true" : "false");
    radioBtn.classList.toggle("active-btn", !hidden);
  });
  queueBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    hideStations();
    hideHistory();
    const hidden = queuePanel.classList.toggle("hidden");
    queuePanel.setAttribute("aria-hidden", hidden ? "true" : "false");
    queueBtn.classList.toggle("active-btn", !hidden);
  });
  historyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    hideStations();
    hideQueue();
    const hidden = historyPanel.classList.toggle("hidden");
    historyPanel.setAttribute("aria-hidden", hidden ? "true" : "false");
    historyBtn.classList.toggle("active-btn", !hidden);
    if (!hidden) renderHistoryTab();
  });
  if (likeBtn) {
    likeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleLikeTrack();
    });
  }
  if (tabHistory) {
    tabHistory.addEventListener("click", (e) => { e.stopPropagation(); showHistoryTab("history"); });
  }
  if (tabLiked) {
    tabLiked.addEventListener("click", (e) => { e.stopPropagation(); showHistoryTab("liked"); });
  }
  if (historyPanel) {
    historyPanel.addEventListener("click", (e) => e.stopPropagation());
  }

  // RadioBrowser search input (debounced)
  const searchInput = $("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => searchRadioBrowser(searchInput.value), 350);
    });
    searchInput.addEventListener("click", (e) => e.stopPropagation());
    searchInput.addEventListener("keydown", (e) => e.stopPropagation());
  }
  document.addEventListener("click", (e) => {
    if (!stations.classList.contains("hidden")) {
      if (!stations.contains(e.target) && e.target !== radioBtn) hideStations();
    }
    if (!queuePanel.classList.contains("hidden")) {
      if (!queuePanel.contains(e.target) && e.target !== queueBtn) hideQueue();
    }
    if (!historyPanel.classList.contains("hidden")) {
      if (!historyPanel.contains(e.target) && e.target !== historyBtn) hideHistory();
    }
  });

  // Keyboard: ignore typing in search input for shortcuts
  // ========== CRT HUD elements & toggle ==========
  const crtHud = $("crtHud");
  const hudState = $("hudState");
  const hudStationLabel = $("hudStationLabel");
  const hudStation = $("hudStation");
  const hudTrackLabel = $("hudTrackLabel");
  const hudTrack = $("hudTrack");
  const hudFormat = $("hudFormat");
  const hudViz = $("hudViz");
  const hudVol = $("hudVol");
  const hudPosLabel = $("hudPosLabel");
  const hudPos = $("hudPos");
  const hudDurLabel = $("hudDurLabel");
  const hudDur = $("hudDur");

  let showHud = localStorage.getItem("phosphor-hud") !== "false";
  
  function applyHudState() {
    if (!crtHud) return;
    crtHud.classList.toggle("hud-hidden", !showHud);
    if (hudVol) hudVol.textContent = Math.round(parseFloat(volEl.value) * 100) + "%";
  }

  function toggleHud() {
    showHud = !showHud;
    localStorage.setItem("phosphor-hud", showHud);
    applyHudState();
  }

  // ========== CRT glare mouse tracking & click HUD toggle ==========
  if (screen) {
    screen.addEventListener("mousemove", (e) => {
      const rect = screen.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      screen.style.setProperty("--glare-x", `${x}%`);
      screen.style.setProperty("--glare-y", `${y}%`);
    });
    screen.addEventListener("mouseleave", () => {
      screen.style.setProperty("--glare-x", "50%");
      screen.style.setProperty("--glare-y", "30%");
    });
    // Click screen to toggle HUD
    screen.addEventListener("click", (e) => {
      toggleHud();
    });
  }

  // ========== Typewriter & Title Toggling Engine ==========
  let typewriterState = 0; 
  let cursorBlinkTimer = null;
  let textTogglerInterval = null;
  let currentTrackTitle = "—";
  let currentStationTitle = "";

  function stopTextToggler() {
    if (textTogglerInterval) {
      clearTimeout(textTogglerInterval);
      clearInterval(textTogglerInterval);
      textTogglerInterval = null;
    }
    if (cursorBlinkTimer) {
      clearInterval(cursorBlinkTimer);
      cursorBlinkTimer = null;
    }
  }

  function runTypewriterCycle(state) {
    stopTextToggler();
    typewriterState = state;
    
    const displayElement = $("title");
    if (!displayElement) return;

    if (state === 0) {
      // resting track (10 seconds)
      displayElement.textContent = currentTrackTitle;
      textTogglerInterval = setTimeout(() => runTypewriterCycle(1), 10000);
    }
    else if (state === 1) {
      // backspacing track
      let txt = currentTrackTitle;
      let i = txt.length;
      textTogglerInterval = setInterval(() => {
        if (i > 0) {
          displayElement.textContent = txt.substring(0, i - 1) + "▌";
          i--;
        } else {
          clearInterval(textTogglerInterval);
          runTypewriterCycle(2);
        }
      }, 20); // backspace speed
    }
    else if (state === 2) {
      // thinking cursor blinks (1.5 seconds)
      let blinkOn = true;
      displayElement.textContent = "▌";
      cursorBlinkTimer = setInterval(() => {
        blinkOn = !blinkOn;
        displayElement.textContent = blinkOn ? "▌" : "\u200b";
      }, 300);
      
      textTogglerInterval = setTimeout(() => {
        clearInterval(cursorBlinkTimer);
        runTypewriterCycle(3);
      }, 1500);
    }
    else if (state === 3) {
      // typing station
      let txt = currentStationTitle;
      let j = 0;
      textTogglerInterval = setInterval(() => {
        if (j < txt.length) {
          displayElement.textContent = txt.substring(0, j + 1) + "▌";
          j++;
        } else {
          clearInterval(textTogglerInterval);
          displayElement.textContent = txt; // remove cursor at rest
          runTypewriterCycle(4);
        }
      }, 45); // typing speed
    }
    else if (state === 4) {
      // resting station (5 seconds)
      displayElement.textContent = currentStationTitle;
      textTogglerInterval = setTimeout(() => runTypewriterCycle(5), 5000);
    }
    else if (state === 5) {
      // backspacing station
      let txt = currentStationTitle;
      let i = txt.length;
      textTogglerInterval = setInterval(() => {
        if (i > 0) {
          displayElement.textContent = txt.substring(0, i - 1) + "▌";
          i--;
        } else {
          clearInterval(textTogglerInterval);
          runTypewriterCycle(6);
        }
      }, 20);
    }
    else if (state === 6) {
      // thinking cursor blinks (1.5 seconds)
      let blinkOn = true;
      displayElement.textContent = "▌";
      cursorBlinkTimer = setInterval(() => {
        blinkOn = !blinkOn;
        displayElement.textContent = blinkOn ? "▌" : "\u200b";
      }, 300);
      
      textTogglerInterval = setTimeout(() => {
        clearInterval(cursorBlinkTimer);
        runTypewriterCycle(7);
      }, 1500);
    }
    else if (state === 7) {
      // typing track
      let txt = currentTrackTitle;
      let j = 0;
      textTogglerInterval = setInterval(() => {
        if (j < txt.length) {
          displayElement.textContent = txt.substring(0, j + 1) + "▌";
          j++;
        } else {
          clearInterval(textTogglerInterval);
          displayElement.textContent = txt; // remove cursor at rest
          runTypewriterCycle(0);
        }
      }, 45);
    }
  }

  function updateHudTracks() {
    if (!crtHud) return;

    const showHudRow = (label, val, show) => {
      if (label) label.style.display = show ? "inline" : "none";
      if (val) val.style.display = show ? "inline" : "none";
    };

    if (mode === "file") {
      showHudRow(hudStationLabel, hudStation, false);
      showHudRow(hudTrackLabel, hudTrack, true);
      if (hudTrack) hudTrack.textContent = currentTrackTitle || "—";
      const multi = queue.length > 1 && queueIdx >= 0;
      showHudRow(hudPosLabel, hudPos, multi);
      if (hudPos && multi) hudPos.textContent = (queueIdx + 1) + "/" + queue.length;
      const hasDur = audio && isFinite(audio.duration) && audio.duration > 0;
      showHudRow(hudDurLabel, hudDur, hasDur);
      if (hudDur && hasDur) hudDur.textContent = fmt(audio.duration);
    } else if (mode === "radio") {
      showHudRow(hudStationLabel, hudStation, true);
      if (hudStation) hudStation.textContent = currentStationTitle || "—";
      showHudRow(hudTrackLabel, hudTrack, !!(currentTrackTitle && currentTrackTitle !== currentStationTitle));
      if (hudTrack) hudTrack.textContent = currentTrackTitle;
      showHudRow(hudPosLabel, hudPos, false);
      showHudRow(hudDurLabel, hudDur, false);
    } else {
      showHudRow(hudStationLabel, hudStation, false);
      showHudRow(hudTrackLabel, hudTrack, true);
      if (hudTrack) hudTrack.textContent = "—";
      showHudRow(hudPosLabel, hudPos, false);
      showHudRow(hudDurLabel, hudDur, false);
    }

    // Format updates
    if (hudFormat) {
      if (mode === "radio") {
        hudFormat.textContent = "LIVE STREAM";
      } else if (mode === "file") {
        const track = queue[queueIdx];
        if (track && track.type) {
          const sub = track.type.split("/")[1];
          hudFormat.textContent = sub ? sub.toUpperCase() : "AUDIO TAPE";
        } else {
          hudFormat.textContent = "AUDIO TAPE";
        }
      } else {
        hudFormat.textContent = "OFFLINE";
      }
    }
  }

  function updateNowPlayingText(stationName, trackName) {
    const station = stationName || "";
    const track = trackName || "";
    
    // If the station and track haven't changed, and we're already toggling, do nothing.
    if (currentStationTitle === station && currentTrackTitle === track && textTogglerInterval) {
      return;
    }
    
    currentStationTitle = station;
    currentTrackTitle = track;
    
    stopTextToggler();
    
    const displayElement = $("title");
    if (!displayElement) return;
    
    // Update CRT HUD elements
    updateHudTracks();
    updateLikeBtn();
    
    // If it's a file, or radio without song metadata, just display directly without toggling
    if (mode === "file" || !currentStationTitle || !currentTrackTitle || currentTrackTitle === currentStationTitle) {
      displayElement.textContent = currentTrackTitle || currentStationTitle || "—";
      typewriterState = 0;
      return;
    }
    
    // Radio with track metadata: Start toggling periodically!
    runTypewriterCycle(0);
  }

  // Listen to volume input slider to update HUD volume value
  volEl.addEventListener("input", () => {
    if (hudVol) hudVol.textContent = Math.round(parseFloat(volEl.value) * 100) + "%";
  });

  // Initialize HUD
  applyHudState();
  if (hudViz) hudViz.textContent = VIZ_MODES[vizIdx];

  // Theme & viz buttons
  themeBtn.addEventListener("click", cycleTheme);
  vizModeBtn.addEventListener("click", cycleVizMode);
  perfBtn.addEventListener("click", cyclePerfLevel);

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "Escape") { hideStations(); hideQueue(); hideHistory(); return; }
    if (e.key === "r" || e.key === "R") { radioBtn.click(); return; }
    if (e.key === "q" || e.key === "Q") { queueBtn.click(); return; }
    if (e.key === "h" || e.key === "H") { historyBtn.click(); return; }
    if (e.key === "f" || e.key === "F") { openFileDialog(folderIn); return; }
    if (e.key === "y" || e.key === "Y") { toggleCurrentFavourite(); return; }
    if (e.key === "x" || e.key === "X") { repeatBtn.click(); return; }
    if (e.key === "t" || e.key === "T") { cycleTheme(); return; }
    if (e.key === "v" || e.key === "V") { cycleVizMode(); return; }
    if (e.key === "p" || e.key === "P") { cyclePerfLevel(); return; }
    if (e.key === "i" || e.key === "I") { toggleHud(); return; }
    if (!audio && !(mode === "radio")) return;
    switch (e.key) {
      case " ": e.preventDefault(); togglePlay(); break;
      case "n": case "N": nextTrack(); break;
      case "ArrowRight": if (mode === "file" && audio) audio.currentTime = Math.min(audio.duration, audio.currentTime + 5); break;
      case "ArrowLeft":  if (mode === "file" && audio) audio.currentTime = Math.max(0, audio.currentTime - 5); break;
      case "ArrowUp":
        e.preventDefault();
        volEl.value = Math.min(1, parseFloat(volEl.value) + 0.05).toFixed(2);
        volEl.dispatchEvent(new Event("input")); break;
      case "ArrowDown":
        e.preventDefault();
        volEl.value = Math.max(0, parseFloat(volEl.value) - 0.05).toFixed(2);
        volEl.dispatchEvent(new Event("input")); break;
      case "m": muteBtn.click(); break;
    }
  });

  // ========== Resize / visibility ==========
  let resizeTimer = 0;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(layout, 150); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopLoop();
      if (idleRafId) { cancelAnimationFrame(idleRafId); idleRafId = 0; }
    } else if (!player.classList.contains("hidden")) {
      if (idleActive) startIdle();
      else startLoop();
    }
  });

  // ========== Init ==========
  // Restore saved theme
  const savedTheme = localStorage.getItem("phosphor-theme");
  if (savedTheme !== null) {
    const idx = parseInt(savedTheme, 10);
    if (idx >= 0 && idx < THEMES.length) applyTheme(idx);
  } else {
    readPhosphorColors();
  }

  // Restore saved viz mode
  const savedViz = localStorage.getItem("phosphor-viz");
  if (savedViz !== null) {
    const idx = parseInt(savedViz, 10);
    if (idx >= 0 && idx < VIZ_MODES.length) applyVizMode(idx);
  }

  // Restore saved performance level
  const savedPerf = localStorage.getItem("phosphor-perf");
  if (savedPerf !== null) {
    const idx = parseInt(savedPerf, 10);
    if (idx >= 0 && idx < PERF_LEVELS.length) {
      applyPerfLevel(idx);
    } else {
      applyPerfLevel(1); // Default to NORMAL
    }
  } else {
    applyPerfLevel(1); // Default to NORMAL
  }

  // Restore volume
  const savedVol = localStorage.getItem("phosphor-vol");
  if (savedVol !== null) {
    const v = parseFloat(savedVol);
    if (v >= 0 && v <= 1) {
      volEl.value = v;
      syncMuteBtn(v === 0);
    }
  }

  // Restore repeat mode
  const savedRepeat = localStorage.getItem("phosphor-repeat");
  if (savedRepeat !== null) {
    repeatMode = parseInt(savedRepeat, 10) % 3;
    repeatBtn.classList.toggle("active-btn", repeatMode >= 1);
    repeatBtn.classList.toggle("repeat-one", repeatMode === 2);
  }

  // Load favourites and build station list
  loadFavourites();
  loadHistory();
  buildStations();

  // Boot: show player immediately with NO SIGNAL idle screen
  showPlayer();
  seek.disabled = true;
  titleEl.textContent = "PRESS R FOR RADIO · DROP FILES TO PLAY";
  startIdle();
  triggerCRTOn();
  updateLikeBtn();
})();
