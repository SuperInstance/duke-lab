/* ============================================================================
   DUKE LAB — app.js
   Studio layer: DOM, canvas, WebAudio. All honesty lives in engine.js;
   this file only performs the argument.
   ========================================================================== */
(function () {
  'use strict';
  const E = window.DukeLab;
  const $ = (id) => document.getElementById(id);

  /* ------------------------------ state ------------------------------ */
  const S = {
    artist: 'duke',
    persona: 'purist',
    run: null,          // result of E.runArgument
    roundIdx: 0,
    playing: false,
    stepped: false,
    pendingNudges: {},
    personaSwaps: {},
    stepCount: 0,
    blind: null,
    duet: null,          // set when the bandstand is showing a conversation
    matured: null,       // the last run's evolved params, ready to sit in
    askLog: [],
    fleetLive: false,
    audition: true,
  };
  const BEAT_SEC = 60 / 96; // engine tempo is 96

  /* --------------------------- fleet client --------------------------- */
  const Fleet = {
    url: localStorage.getItem('dukelab-worker') || '',
    post(path, body, ms) {
      return fetch(this.url.replace(/\/$/, '') + path, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body || {}), signal: AbortSignal.timeout(ms || 12000),
      }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    },
    get(path, ms) {
      return fetch(this.url.replace(/\/$/, '') + path, { signal: AbortSignal.timeout(ms || 6000) })
        .then(r => (r.ok ? r.json() : null)).catch(() => null);
    },
    musician(description) { return this.post('/api/musician', { description }); },
    judge(description) { return this.post('/api/judge', { description }); },
    learn(payload) { return this.post('/api/learn', payload); },
    ledger() { return this.get('/api/ledger'); },
    async health() {
      if (!this.url) return false;
      try {
        const r = await fetch(this.url.replace(/\/$/, '') + '/health', { signal: AbortSignal.timeout(1800) });
        return r.ok;
      } catch { return false; }
    },
    async ask(text, features) {
      if (S.fleetLive) {
        try {
          const r = await fetch(this.url.replace(/\/$/, '') + '/api/ask', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text, artist: S.artist, features }),
            signal: AbortSignal.timeout(12000),
          });
          if (r.ok) return await r.json(); // {delta, matched, source:'fleet'}
        } catch { /* fall through to local dice — honesty has a floor */ }
      }
      const local = E.parseAsk(text);
      return { ...local, source: 'local-lexicon' };
    },
  };
  async function refreshModeBadge() {
    S.fleetLive = await Fleet.health();
    const b = $('modeBadge');
    if (S.fleetLive) { b.textContent = 'LIVE FLEET MODE'; b.classList.add('live'); }
    else { b.textContent = 'LOCAL SEED MODE'; b.classList.remove('live'); }
    $('workerStatus').textContent = S.fleetLive
      ? 'worker live — asks are parsed by the fleet ear.'
      : (Fleet.url ? 'worker unreachable — local lexicon stands in. honesty has a floor.' : 'no worker set — running on honest local dice (seed-verifiable).');
  }

  /* ------------------------------ audio ------------------------------ */
  const Audio = {
    ctx: null, master: null, schedTimer: null, startTime: 0, startBeat: 0,
    noiseBuf: null,
    ensure() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 4;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      // noise for brushes
      const len = this.ctx.sampleRate * 1.2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    },
    voice(t, dur, midi, vel, kind) {
      const c = this.ctx, f = 440 * Math.pow(2, (midi - 69) / 12);
      const g = c.createGain();
      const v = Math.pow(vel / 127, 1.4);
      if (kind === 'melody' || kind === 'melody2') {
        const o1 = c.createOscillator(), o2 = c.createOscillator(), flt = c.createBiquadFilter();
        o1.type = 'triangle'; o2.type = 'triangle';
        o1.frequency.value = f; o2.frequency.value = f * (kind === 'melody2' ? 1.006 : 1.003);
        flt.type = 'lowpass'; flt.frequency.value = 900 + vel * 18; flt.Q.value = 0.7;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(v * (kind === 'melody2' ? 0.24 : 0.30), t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.24, dur * BEAT_SEC * 0.9));
        o1.connect(flt); o2.connect(flt); flt.connect(g); g.connect(this.master);
        o1.start(t); o2.start(t); o1.stop(t + 1.6); o2.stop(t + 1.6);
      } else if (kind === 'bass' || kind === 'bass2') {
        const o1 = c.createOscillator(), o2 = c.createOscillator();
        o1.type = 'sine'; o2.type = kind === 'bass2' ? 'sawtooth' : 'triangle';
        o1.frequency.value = f; o2.frequency.value = f; o2.detune.value = kind === 'bass2' ? 7 : 4;
        const og = c.createGain(); og.gain.value = kind === 'bass2' ? 0.25 : 0.4;
        const flt = c.createBiquadFilter();
        flt.type = 'lowpass'; flt.frequency.value = 420;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(v * (kind === 'bass2' ? 0.4 : 0.5), t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.3, dur * BEAT_SEC));
        o1.connect(og); o2.connect(og); og.connect(flt); flt.connect(g); g.connect(this.master);
        o1.start(t); o2.start(t); o1.stop(t + 1.8); o2.stop(t + 1.8);
      } else if (kind === 'comp') {
        // stacked third + seventh, sustained quietly — the voicing ghost
        [0, 4, 7, 10].forEach((iv) => {
          const o = c.createOscillator(), og = c.createGain();
          o.type = 'sine'; o.frequency.value = f * Math.pow(2, iv / 12);
          og.gain.value = 0.22;
          const gg = c.createGain();
          gg.gain.setValueAtTime(0, t);
          gg.gain.linearRampToValueAtTime(v * 0.12, t + 0.02);
          gg.gain.exponentialRampToValueAtTime(0.001, t + dur * BEAT_SEC);
          o.connect(og); og.connect(gg); gg.connect(this.master);
          o.start(t); o.stop(t + dur * BEAT_SEC + 0.3);
        });
      }
    },
    brush(t, kind, vel) {
      const c = this.ctx;
      const src = c.createBufferSource(); src.buffer = this.noiseBuf;
      const flt = c.createBiquadFilter(), g = c.createGain();
      if (kind === 'snare') { flt.type = 'bandpass'; flt.frequency.value = 1800; flt.Q.value = 0.9; }
      else { flt.type = 'highpass'; flt.frequency.value = 7000; }
      const v = kind === 'snare' ? vel * 0.14 : vel * 0.05;
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'snare' ? 0.18 : 0.06));
      src.connect(flt); flt.connect(g); g.connect(this.master);
      src.start(t); src.stop(t + 0.3);
    },
    events() { if (S.duet) return S.duet.events; const r = currentRound(); return r ? r.events : []; },
    play(fromBeat) { this.playWindow(fromBeat || 0, 64 - (fromBeat || 0)); },
    playWindow(fromBeat, beats) {
      this.ensure(); this.ctx.resume();
      this.stop();
      this.startBeat = fromBeat;
      this.startTime = this.ctx.currentTime + 0.08;
      S.playing = true;
      $('btnPlay').textContent = '❚❚ playing';
      const evs = this.events().filter(e => e.t >= fromBeat && e.t < fromBeat + beats);
      const round = currentRound();
      const swing = round && !S.duet ? round.params.swingFeel * 0.33 : 0.15;
      evs.forEach(e => {
        this.voice(this.startTime + (e.t - fromBeat) * BEAT_SEC, e.dur, e.midi, e.vel, e.voice === 'comp' ? 'comp' : e.voice);
      });
      for (let b = Math.ceil(fromBeat); b < fromBeat + beats; b++) {
        this.brush(this.startTime + (b - fromBeat) * BEAT_SEC, 'snare', b % 4 === 2 ? 1 : 0.0001);
        if (b % 2 === 1) this.brush(this.startTime + (b - fromBeat) * BEAT_SEC + swing * BEAT_SEC, 'hat', 1);
      }
      this.endAt = this.startTime + beats * BEAT_SEC + 0.5;
      this.schedTimer = setInterval(() => {
        Roll.draw();
        const el = Math.max(0, this.ctx.currentTime - this.startTime);
        $('timeLabel').textContent = fmt(Math.min(el, beats * BEAT_SEC)) + ' / ' + fmt(beats * BEAT_SEC);
        if (this.ctx.currentTime > this.endAt) this.stop();
      }, 40);
    },
    stop() {
      if (this.schedTimer) clearInterval(this.schedTimer);
      this.schedTimer = null; S.playing = false;
      $('btnPlay').textContent = '▶ play take';
      Roll.draw();
    },
  };
  function fmt(s) { return (s < 10 ? '0' : '') + s.toFixed(1); }

  /* ---------------------------- piano roll ---------------------------- */
  const Roll = {
    cv: null, ctx: null,
    init() { this.cv = $('pianoroll'); this.ctx = this.cv.getContext('2d'); this.resize(); window.addEventListener('resize', () => this.resize()); },
    resize() { const r = this.cv.getBoundingClientRect(); this.cv.width = r.width * devicePixelRatio; this.cv.height = 190 * devicePixelRatio; },
    draw() {
      const c = this.ctx, W = this.cv.width, H = this.cv.height;
      c.clearRect(0, 0, W, H);
      c.fillStyle = '#0b0d10'; c.fillRect(0, 0, W, H);
      const evs = Audio.events();
      if (!evs.length) return;
      const lo = 28, hi = 100;
      const y = (m) => H - ((m - lo) / (hi - lo)) * H;
      const x = (t) => (t / 64) * W;
      // bar grid
      c.strokeStyle = 'rgba(232,228,218,0.07)'; c.lineWidth = 1;
      for (let b = 0; b <= 16; b++) { c.beginPath(); c.moveTo(x(b * 4), 0); c.lineTo(x(b * 4), H); c.stroke(); }
      const playBeat = (S.playing && Audio.ctx) ? (Audio.ctx.currentTime - Audio.startTime) + Audio.startBeat : -1;
      evs.forEach(e => {
        const px = x(e.t), pw = Math.max(2, (e.dur / 64) * W);
        c.fillStyle = e.voice === 'melody' ? 'rgba(212,169,78,0.85)' : e.voice === 'melody2' ? 'rgba(240,205,127,0.9)' : e.voice === 'bass' ? 'rgba(91,168,160,0.75)' : e.voice === 'bass2' ? 'rgba(127,212,204,0.8)' : 'rgba(232,228,218,0.22)';
        c.fillRect(px, y(e.midi), pw, 3 * devicePixelRatio);
      });
      if (playBeat >= 0 && playBeat <= 64) {
        c.strokeStyle = 'rgba(240,205,127,0.9)'; c.lineWidth = 1.5 * devicePixelRatio;
        c.beginPath(); c.moveTo(x(playBeat), 0); c.lineTo(x(playBeat), H); c.stroke();
      }
    },
  };

  /* ------------------------------- radar ------------------------------- */
  const Radar = {
    cv: null, ctx: null,
    init() { this.cv = $('radar'); this.ctx = this.cv.getContext('2d'); this.resize(); window.addEventListener('resize', () => this.resize()); },
    resize() { const r = this.cv.getBoundingClientRect(); this.cv.width = r.width * devicePixelRatio; this.cv.height = 240 * devicePixelRatio; },
    draw() {
      const c = this.ctx, W = this.cv.width, H = this.cv.height;
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 22 * devicePixelRatio;
      c.clearRect(0, 0, W, H);
      const N = 16;
      const pt = (i, v) => {
        const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
        return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v];
      };
      // rings
      for (let ring = 1; ring <= 4; ring++) {
        c.beginPath();
        for (let i = 0; i <= N; i++) { const [x, y] = pt(i % N, ring / 4); i ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.strokeStyle = 'rgba(232,228,218,0.08)'; c.lineWidth = 1; c.stroke();
      }
      // ideal centroid (the canon, dashed brass) — only if run exists
      const run = S.run;
      const drawPoly = (vec, stroke, fill, dash) => {
        c.beginPath();
        vec.forEach((v, i) => { const [x, y] = pt(i, Math.max(0.02, v)); i ? c.lineTo(x, y) : c.moveTo(x, y); });
        c.closePath();
        if (fill) { c.fillStyle = fill; c.fill(); }
        c.setLineDash(dash || []); c.strokeStyle = stroke; c.lineWidth = 1.6 * devicePixelRatio; c.stroke(); c.setLineDash([]);
      };
      if (run) {
        const idealVec = E.FEATURES.map(f => run.ideal[f.id]);
        const effVec = E.FEATURES.map(f => run.effective[f.id]);
        drawPoly(idealVec, 'rgba(212,169,78,0.55)', null, [5, 4]);
        drawPoly(effVec, 'rgba(232,228,218,0.35)', null, [2, 3]);
        const cur = currentRound();
        if (cur) drawPoly(cur.features, 'rgba(91,168,160,0.95)', 'rgba(91,168,160,0.14)');
        // the medium floor gap: ideal vs effective, annotated on first axis pair
        c.font = `${9 * devicePixelRatio}px IBM Plex Mono`;
        c.fillStyle = 'rgba(212,169,78,0.8)';
        c.fillText('— — canon', 6 * devicePixelRatio, 12 * devicePixelRatio);
        c.fillStyle = 'rgba(232,228,218,0.55)';
        c.fillText('- - reachable', 6 * devicePixelRatio, 24 * devicePixelRatio);
        c.fillStyle = 'rgba(91,168,160,0.9)';
        c.fillText('— take', 6 * devicePixelRatio, 36 * devicePixelRatio);
      } else {
        c.fillStyle = 'rgba(232,228,218,0.25)';
        c.font = `${11 * devicePixelRatio}px IBM Plex Mono`;
        c.textAlign = 'center';
        c.fillText('the eye waits for a take', cx, cy);
        c.textAlign = 'left';
      }
    },
  };

  /* --------------------------- sigma path viz -------------------------- */
  function drawSigmaPath() {
    const cv = $('sigmaPath'), c = cv.getContext('2d');
    const r = cv.getBoundingClientRect(); cv.width = r.width * devicePixelRatio; cv.height = 54 * devicePixelRatio;
    const W = cv.width, H = cv.height;
    c.clearRect(0, 0, W, H);
    const run = S.run; if (!run || !run.rounds.length) return;
    const sigs = run.rounds.map(x => x.sigma);
    const max = Math.max(...sigs, 0.4) * 1.1;
    const x = (i) => (i / Math.max(1, sigs.length - 1)) * (W - 8) + 4;
    const y = (v) => H - 6 - (v / max) * (H - 14);
    // golden-ratio reference segments: 0.618^k of initial
    c.strokeStyle = 'rgba(212,169,78,0.18)';
    for (let k = 1; k <= 3; k++) {
      const yy = y(sigs[0] * Math.pow(1 / E.PHI, k));
      c.beginPath(); c.moveTo(0, yy); c.lineTo(W, yy); c.stroke();
    }
    c.beginPath();
    sigs.forEach((s, i) => i ? c.lineTo(x(i), y(s)) : c.moveTo(x(i), y(s)));
    c.strokeStyle = '#d4a94e'; c.lineWidth = 1.8 * devicePixelRatio; c.stroke();
    sigs.forEach((s, i) => {
      c.beginPath(); c.arc(x(i), y(s), (i === S.roundIdx ? 4 : 2.4) * devicePixelRatio, 0, 7);
      c.fillStyle = i === S.roundIdx ? '#f0cd7f' : '#d4a94e'; c.fill();
    });
  }

  /* ------------------------- fingers sliders --------------------------- */
  function renderSliders(attacked) {
    const host = $('sliders');
    const round = currentRound();
    if (!round) { host.innerHTML = '<div style="font-family:var(--mono);font-size:11px;color:var(--paper-dim)">sixteen hands, waiting.</div>'; return; }
    const ideal = S.run.ideal;
    host.innerHTML = E.FEATURES.map(f => {
      const v = round.params[f.id];
      const tgt = ideal[f.id];
      const isAtk = attacked && attacked.includes(f.id);
      return `<div class="slider-row ${isAtk ? 'attacked' : ''}" title="${f.note}">
        <span class="lbl">${f.label}</span>
        <span class="val"><i style="width:${(v * 100).toFixed(1)}%"></i><span class="tgt" style="left:${(tgt * 100).toFixed(1)}%"></span></span>
      </div>`;
    }).join('');
  }

  /* --------------------------- notation ------------------------------- */
  let prevSong = '';
  function renderNotation() {
    const round = currentRound();
    const el = $('notation');
    if (!round) return;
    const song = round.song;
    const prevTokens = prevSong ? tokenSet(prevSong) : null;
    el.innerHTML = song.split('\n').map(line => {
      if (line.startsWith('**')) return `<span class="head">${esc(line)}</span>`;
      if (line.startsWith('[') || line.startsWith('key:') || line.startsWith('time:')) return `<span class="meta">${esc(line)}</span>`;
      // diff: highlight tokens present now that weren't in the previous round
      const out = line.replace(/(\S+)/g, (tok) => {
        if (!prevTokens || tok.length < 2 || tok === '|' || tok === '.') return esc(tok);
        if (!prevTokens.has(tok)) return `<span class="chg">${esc(tok)}</span>`;
        return `<span class="tok">${esc(tok)}</span>`;
      });
      return out;
    }).join('\n');
    prevSong = song;
  }
  function tokenSet(s) { return new Set(s.split(/\s+/).filter(t => t.length > 1)); }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  /* ----------------------------- verdicts ------------------------------ */
  function renderVerdicts() {
    const round = currentRound();
    const ul = $('verdicts');
    if (!round) { ul.innerHTML = ''; return; }
    $('sigmaNow').textContent = round.sigma.toFixed(3);
    $('personaName').textContent = E.PERSONAS[round.persona].name;
    ul.innerHTML = round.critiques.map((c, i) =>
      `<li class="${i === 0 ? 'hot' : ''}">${esc(c.line)}</li>`).join('');
  }

  /* ----------------------------- timeline ------------------------------ */
  function renderTimeline() {
    const host = $('timeline');
    const run = S.run; if (!run) { host.innerHTML = ''; return; }
    const best = Math.min(...run.rounds.map(r => r.sigma));
    host.innerHTML = run.rounds.map(r =>
      `<span class="rchip ${r.round === S.roundIdx ? 'cur' : ''} ${r.sigma === best ? 'best' : ''}" data-r="${r.round}">R${r.round} · ${r.sigma.toFixed(2)}</span>`
    ).join('');
    host.querySelectorAll('.rchip').forEach(ch => ch.onclick = () => { selectRound(+ch.dataset.r); });
  }

  /* ------------------------------ journal ------------------------------ */
  function renderJournal() {
    const el = $('journal');
    const run = S.run; if (!run) return;
    el.innerHTML = run.log.map(l => {
      const cls = l.kind === 'swap' ? 'swap' : l.kind === 'nudge' ? 'swap' : 'r';
      return `<span class="${cls}">R${l.round}</span>  ${esc(l.text)}`;
    }).join('\n');
    el.scrollTop = el.scrollHeight;
  }

  /* --------------------------- verdict banner -------------------------- */
  function renderBanner() {
    const b = $('verdictBanner');
    const run = S.run;
    if (!run || !run.verdict) { b.className = ''; return; }
    const v = run.verdict;
    if (v.status === 'CONVERGED') {
      b.className = 'show';
      b.querySelector('.v-title').textContent = '“I can no longer tell if this is a take I have never heard.”';
      b.querySelector('.v-body').textContent =
        `Converged in ${v.round} rounds (EMA σ=${(v.sigma || run.rounds[v.round].sigma).toFixed(3)}). The argument ended by mutual prediction — ` +
        `each side can model the other. Style is what the argument never managed to finish; here, it finished enough.`;
    } else {
      b.className = 'show gap';
      const residue = (v.residue && v.residue.length ? v.residue : E.mediumResidue(S.artist).map(d => d.id)).slice(0, 4);
      const labels = residue.map(id => (E.FEATURES.find(f => f.id === id) || { label: id }).label);
      b.querySelector('.v-title').textContent = 'HONEST GAP — not converged';
      b.querySelector('.v-body').textContent =
        `Best σ=${v.sigma.toFixed(3)} after ${v.round} rounds. Declared openly, per the journal: the residue is ` +
        `${labels.join(', ').toLowerCase() || 'unnamed'} — axes the medium can’t fully reach. ` +
        `That residue is not failure; it is the style itself.`;
    }
  }

  /* --------------------------- round selection ------------------------- */
  function currentRound() { return S.run && S.run.rounds[S.roundIdx]; }
  function selectRound(i) {
    if (!S.run || !S.run.rounds[i]) return;
    Audio.stop();
    S.roundIdx = i;
    const r = S.run.rounds[i];
    prevSong = i > 0 ? S.run.rounds[i - 1].song : '';
    renderNotation(); renderVerdicts(); renderSliders(r.critiques.map(c => c.axis));
    renderTimeline(); Radar.draw(); drawSigmaPath(); Roll.draw();
    $('runMeta').textContent = `round ${i}/${S.run.rounds.length - 1} · seed ${S.run.seed} · ${E.ARTISTS[S.artist].name}`;
  }

  /* ------------------------------ the run ------------------------------ */
  const AUDITION_BEATS = 8; // hear two bars of every round as the argument plays
  async function doRun(maxRounds) {
    Audio.stop();
    const seed = $('seedInput').value.trim() || ('duke-lab/' + Date.now().toString(36));
    $('seedInput').value = seed;
    const conv = 0.125; // judged against the reachable canon (see engine)
    // consume sticky asks/persona-swaps at run start (not before — leaning in then running must keep the words)
    const nudges = { ...S.pendingNudges }; S.pendingNudges = {};
    const swaps = { ...S.personaSwaps }; S.personaSwaps = {};
    const run = E.runArgument({
      seed, artist: S.artist, persona: S.persona, maxRounds: maxRounds || 8,
      convergence: conv, nudges, personaSwaps: swaps,
    });
    S.run = run; S.roundIdx = 0;
    $('verdictBanner').className = '';
    $('footSeed').textContent = seed;
    // play the argument out round by round — heard as well as seen
    for (let i = 0; i < run.rounds.length; i++) {
      selectRound(i);
      renderJournal();
      $('runMeta').textContent = `round ${i}/${run.rounds.length - 1} · seed ${seed} · ${E.ARTISTS[S.artist].name}` +
        (S.audition ? ' · auditioning two bars…' : '');
      const canSound = !navigator.userActivation || navigator.userActivation.hasBeenActive;
      if (S.audition && i > 0 && canSound) Audio.playWindow(0, AUDITION_BEATS);
      else if (S.audition && i > 0 && i === 1) $('runMeta').textContent += ' · (audio needs one click/keypress — browser autoplay law)';
      await wait(i === 0 ? 600 : 5600);
      if (S.run !== run) return; // superseded
    }
    Audio.stop();
    renderBanner(); renderJournal();
    const v = run.verdict;
    $('runMeta').textContent = v.status === 'CONVERGED'
      ? `converged in ${v.round} rounds · seed ${seed} · σ EMA ${(v.sigma || 0).toFixed(3)} — the critic can no longer tell`
      : `honest gap after ${v.round} rounds · seed ${seed} · best σ ${v.sigma.toFixed(3)} — residue named, not hidden`;
    // the run has matured: its final params can sit in with another musician
    const bestR = run.rounds[v.round] || run.rounds[run.rounds.length - 1];
    S.matured = { key: 'g:' + seed, name: 'EVOLVED ' + seed.split('/')[0].toUpperCase(), artistKey: S.artist, params: { ...bestR.params } };
    refreshDuetSelects();
    // every generation helps — unless the visitor asked us not to look
    if (Fleet.url && !$('optLedger').checked) {
      Fleet.learn({
        seed, canon: S.artist, judge: S.persona, verdict: v.status, rounds: v.round,
        sigma: +(v.sigma || bestR.sigma || 0), asks: Object.values(nudges).map(n => JSON.stringify(n)),
        finalParams: bestR.params, musicianName: S.matured.name,
      }).then(() => refreshLedger());
    }
  }
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* step mode: one round at a time, re-running deterministically is wasteful —
     so we cache the full run on first step and reveal rounds progressively. */
  let stepRun = null;
  function doStep() {
    if (!stepRun || stepRun.seed !== $('seedInput').value.trim() || stepRun._artist !== S.artist || stepRun._persona !== S.persona) {
      const seed = $('seedInput').value.trim() || ('duke-lab/' + Date.now().toString(36));
      const nudges = { ...S.pendingNudges }; S.pendingNudges = {};
      const swaps = { ...S.personaSwaps }; S.personaSwaps = {};
      stepRun = E.runArgument({
        seed, artist: S.artist, persona: S.persona, maxRounds: 8, convergence: 0.125,
        nudges, personaSwaps: swaps,
      });
      stepRun._artist = S.artist; stepRun._persona = S.persona;
      S.run = stepRun; S.roundIdx = 0;
      $('verdictBanner').className = '';
      $('footSeed').textContent = seed;
    }
    const last = stepRun.rounds.length - 1;
    selectRound(Math.min(S.roundIdx, last));
    renderJournal();
    if (S.roundIdx >= last) renderBanner();
    else S.roundIdx++;
  }

  /* ------------------------------ blind test --------------------------- */
  $('btnBlind').onclick = () => {
    const run = S.run;
    if (!run || run.rounds.length < 2) { $('blindResult').textContent = 'run the argument first — need at least two rounds.'; return; }
    const i = 1 + Math.floor(Math.random() * (run.rounds.length - 1));
    const order = Math.random() < 0.5 ? [i - 1, i] : [i, i - 1];
    S.blind = { later: i, order, played: 0 };
    $('blindResult').textContent = 'playing two short excerpts… which is the LATER round?';
    playExcerpt(order[0], 0, () => setTimeout(() => playExcerpt(order[1], 1, () => {
      $('blindResult').innerHTML = 'guess: <button id="g0">first</button> <button id="g1">second</button>';
      $('g0').onclick = () => blindJudge(0);
      $('g1').onclick = () => blindJudge(1);
    }), 350));
  };
  function playExcerpt(roundIdx, which, done) {
    selectRound(roundIdx);
    Audio.playWindow(0, 8); // two bars — enough phrase to judge, short enough to stay snappy
    setTimeout(() => { done && done(); }, 8 * BEAT_SEC * 1000 + 250);
  }
  function blindJudge(guessIdx) {
    const b = S.blind; if (!b) return;
    const guessedLater = b.order[guessIdx];
    const right = guessedLater === b.later;
    $('blindResult').textContent = right
      ? `correct — R${b.later} was the later take. you can hear the argument work.`
      : `wrong — R${b.later} was the later take. the rounds are closer than they look. σ gap: ${Math.abs(S.run.rounds[b.later].sigma - S.run.rounds[b.later - 1].sigma).toFixed(3)}`;
    S.blind = null;
  }

  /* ------------------------------ exports ------------------------------ */
  function download(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  $('btnSong').onclick = () => {
    const r = currentRound(); if (!r) return;
    download(`duke-lab-r${r.round}.song`, new Blob([r.song], { type: 'text/plain' }));
  };
  $('btnMidi').onclick = () => {
    const r = currentRound(); if (!r) return;
    const bytes = E.toMidi(r.events, 96);
    download(`duke-lab-r${r.round}.mid`, new Blob([bytes.buffer], { type: 'audio/midi' }));
  };
  $('btnCopy').onclick = () => {
    const r = currentRound(); if (!r) return;
    navigator.clipboard.writeText(r.song).then(() => {
      $('btnCopy').textContent = 'copied'; setTimeout(() => $('btnCopy').textContent = 'copy', 1200);
    });
  };

  /* ------------------------------ wiring ------------------------------- */
  $('artistChips').querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
    $('artistChips').querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
    ch.classList.add('on'); S.artist = ch.dataset.artist; stepRun = null; S.run = null;
    $('runMeta').textContent = `${E.ARTISTS[S.artist].name} selected — ${E.ARTISTS[S.artist].blurb}`;
    Roll.draw(); Radar.draw();
  });
  $('personaChips').querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
    const next = ch.dataset.persona;
    if (S.run && next !== S.persona) {
      // mid-run swap = the gardener changes; settled ground re-opens
      S.personaSwaps[(S.roundIdx || 0) + 1] = next;
    }
    $('personaChips').querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
    ch.classList.add('on'); S.persona = next;
    $('personaName').textContent = E.PERSONAS[next].name;
  });
  $('btnBegin').onclick = () => doRun(8);
  $('btnBeginHero').onclick = () => { document.querySelector('.studio').scrollIntoView({ behavior: 'smooth' }); doRun(8); };
  $('btnStep').onclick = doStep;
  $('btnReroll').onclick = () => {
    const words = ['cresleigh', 'last-ferry', 'jungle', 'harlem', 'azure', 'mood-indigo', 'caravan', 'satin', 'prelude', 'lullaby'];
    $('seedInput').value = words[Math.floor(Math.random() * words.length)] + '/' + Math.floor(Math.random() * 16);
    stepRun = null;
  };
  $('btnAsk').onclick = async () => {
    const text = $('askInput').value.trim();
    if (!text) return;
    const res = await Fleet.ask(text, currentRound() ? currentRound().features : null);
    S.pendingNudges[S.roundIdx + (S.run ? 1 : 0)] = res.delta;
    const src = res.source === 'fleet' ? 'fleet ear' : 'local lexicon';
    $('askStatus').textContent = `heard (${src}): ${Object.entries(res.delta).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v.toFixed(2)}`).join(' · ') || 'no match — try moody, space, swing, angular'}`;
  };
  $('askInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnAsk').click(); });
  $('btnPlay').onclick = () => { if (S.playing) Audio.stop(); else if (currentRound()) Audio.play(0); };
  $('btnStop').onclick = () => Audio.stop();
  $('btnAudition').onclick = () => {
    S.audition = !S.audition;
    $('btnAudition').textContent = 'audition rounds: ' + (S.audition ? 'on' : 'off');
    $('btnAudition').classList.toggle('primary', S.audition);
  };
  $('btnWorkerSave').onclick = () => {
    localStorage.setItem('dukelab-worker', $('workerUrl').value.trim());
    Fleet.url = $('workerUrl').value.trim();
    refreshModeBadge();
    refreshLedger();
  };

  /* ------------------------------- boot -------------------------------- */
  /* ------------------------- the workshop ------------------------------ */
  // Designed musicians register into the same canon; vibe-coded judges into
  // the same persona bench. The machine doesn't special-case them — that is
  // the point of designing in the open.
  function addChip(rowId, label, dataset, onClick) {
    const chip = document.createElement('span');
    chip.className = 'chip'; chip.textContent = label;
    Object.entries(dataset).forEach(([k, v]) => (chip.dataset[k] = v));
    chip.onclick = onClick;
    $(rowId).appendChild(chip);
    return chip;
  }
  $('btnMakeMusician').onclick = async () => {
    const text = $('shopMusician').value.trim();
    if (!text) return;
    const st = $('shopMusicianStatus');
    st.textContent = 'designing…';
    let m = null, source = 'local lexicon';
    if (Fleet.url && S.fleetLive) {
      const r = await Fleet.musician(text);
      if (r && r.ok && r.musician) { m = r.musician; source = r.musician.source === 'llm' ? 'fleet ear' : 'local lexicon'; }
    }
    if (!m) {
      const l = E.parseAsk(text); // honest local design path
      const centroid = {};
      E.FEATURES.forEach(f => (centroid[f.id] = E.clamp(E.ARTISTS.duke.centroid[f.id] + (l.delta[f.id] || 0), 0, 1)));
      m = { id: 'local/' + E.fnv1a(text).toString(36), name: text.split(/\s+/).filter(w => w.length > 2).slice(0, 2).join(' ').toUpperCase() || 'THE SAILOR', centroid };
    }
    const key = 'm:' + m.id;
    E.registerArtist(key, { name: m.name, blurb: m.blurb || 'Designed on the bandstand.', centroid: m.centroid, progression: m.progression || 'duke' });
    const chip = addChip('artistChips', m.name, { artist: key }, null);
    chip.onclick = () => {
      $('artistChips').querySelectorAll('.chip').forEach(x => x.classList.remove('on'));
      chip.classList.add('on'); S.artist = key; stepRun = null; S.run = null;
      $('runMeta').textContent = `${E.ARTISTS[key].name} takes the chair — designed, not canon.`;
      Roll.draw(); Radar.draw();
    };
    chip.click();
    st.textContent = `${m.name} joins the canon · via ${source}${m.persisted === false ? ' · (ledger unbound — worker has no D1 yet)' : ' · logged to the ledger'}`;
    refreshDuetSelects();
    refreshLedger();
  };
  $('btnMakeJudge').onclick = async () => {
    const text = $('shopJudge').value.trim();
    if (!text) return;
    const st = $('shopJudgeStatus');
    st.textContent = 'seating…';
    let j = null, source = 'local lexicon';
    if (Fleet.url && S.fleetLive) {
      const r = await Fleet.judge(text);
      if (r && r.ok && r.judge) { j = r.judge; source = r.judge.source === 'llm' ? 'fleet ear' : 'local lexicon'; }
    }
    if (!j) {
      const l = E.parseAsk(text);
      const weights = {};
      E.FEATURES.forEach(f => { const w = 1 + Math.abs(l.delta[f.id] || 0) * 8; if (w > 1.15) weights[f.id] = +w.toFixed(2); });
      if (!Object.keys(weights).length) { weights.restRatio = 1.8; weights.dynContour = 1.4; }
      j = { id: 'local/' + E.fnv1a(text).toString(36), name: text.split(/\s+/).filter(w => w.length > 2).slice(0, 2).join(' ').toUpperCase() || 'THE CRITIC', weights, floor: 0, voice: '' };
    }
    const key = 'j:' + j.id;
    E.registerPersona(key, { name: j.name, weights: j.weights });
    const chip = addChip('personaChips', j.name, { persona: key }, null);
    chip.onclick = () => {
      const next = key;
      if (S.run && next !== S.persona) S.personaSwaps[(S.roundIdx || 0) + 1] = next;
      $('personaChips').querySelectorAll('.chip').forEach(x => x.classList.remove('on'));
      chip.classList.add('on'); S.persona = next;
      $('personaName').textContent = E.PERSONAS[next].name;
    };
    chip.click();
    st.textContent = `${j.name} takes the bench · cares about ${Object.keys(j.weights).slice(0, 4).join(', ')} · via ${source}`;
  };

  /* ------------------------- the bandstand ----------------------------- */
  function duetVoices() {
    const base = Object.keys(E.ARTISTS).map(k => ({ key: k, label: E.ARTISTS[k].name }));
    if (S.matured) base.push({ key: S.matured.key, label: S.matured.name + ' (matured this session)', obj: S.matured });
    return base;
  }
  function refreshDuetSelects() {
    const vs = duetVoices();
    ['duetA', 'duetB'].forEach((id, ix) => {
      const sel = $(id), cur = sel.value;
      sel.innerHTML = '';
      vs.forEach(v => {
        const o = document.createElement('option');
        o.value = v.key; o.textContent = v.label;
        sel.appendChild(o);
      });
      sel.value = cur && vs.some(v => v.key === cur) ? cur : vs[ix === 0 ? 0 : Math.min(1, vs.length - 1)].key;
    });
  }
  function resolveDuetVoice(key) {
    if (E.ARTISTS[key]) return key;
    if (S.matured && key === S.matured.key) return S.matured;
    return 'duke';
  }
  $('btnDuet').onclick = () => {
    const a = resolveDuetVoice($('duetA').value), b = resolveDuetVoice($('duetB').value);
    const seed = 'duet/' + ($('seedInput').value.trim() || 'open-mic');
    const duet = E.runDuet({ seed, a, b, phrases: 4 });
    S.duet = duet;
    Audio.stop();
    $('banterLog').innerHTML = (duet.log.length ? duet.log.map(l => '↳ ' + l).join('<br>') + '<br>' : '') +
      `↳ banter ${duet.banter} — ${duet.banter >= 0.6 ? 'they are actually listening to each other' : duet.banter >= 0.3 ? 'polite nods, mostly' : 'two monologues, one stage'}`;
    $('notation').textContent = duet.song;
    $('runMeta').textContent = `duet · ${duet.a} × ${duet.b} · ${duet.beats} beats · ${duet.quotes} quote${duet.quotes === 1 ? '' : 's'}`;
    Roll.draw();
    if (Fleet.url && !$('optLedger').checked) {
      Fleet.learn({ seed, canon: 'duet:' + duet.a + '×' + duet.b, judge: '—', verdict: 'DUET', rounds: duet.phrases.length, sigma: 0, banter: duet.banter }).then(() => refreshLedger());
    }
  };
  $('btnDuetPlay').onclick = () => { if (!S.duet) return; const canSound = !navigator.userActivation || navigator.userActivation.hasBeenActive; if (canSound) Audio.playWindow(0, S.duet.beats); else $('runMeta').textContent += ' · (audio needs one click first — autoplay law)'; };
  $('btnDuetMidi').onclick = () => {
    if (!S.duet) return;
    const bytes = E.toMidi(S.duet.events, 96);
    download('duke-lab-duet.mid', new Blob([bytes.buffer], { type: 'audio/midi' }));
  };

  /* ------------------------- the ledger -------------------------------- */
  async function refreshLedger() {
    if (!Fleet.url) return;
    const j = await Fleet.ledger();
    if (!j || !j.persisted) { $('ledgerLine').textContent = 'ledger: — (worker has no D1 binding yet — see worker/schema.sql)'; return; }
    const evolved = j.recent ? j.recent.filter(m => m.source === 'evolved').length : 0;
    $('ledgerLine').textContent = `ledger: ${j.runs} arguments · ${j.musicians} musicians (${evolved} evolved) · ${j.judges} judges` +
      (j.avgSigma != null ? ` · mean σ ${j.avgSigma}` : '') + ' — every generation helps';
  }

  window.addEventListener('DOMContentLoaded', () => {
    Roll.init(); Radar.init();
    $('workerUrl').value = Fleet.url;
    $('runMeta').textContent = `${E.ARTISTS[S.artist].name} selected — ${E.ARTISTS[S.artist].blurb}`;
    renderSliders(null); Roll.draw(); Radar.draw(); drawSigmaPath();
    renderJournal();
    $('journal').textContent = '// the referee narrates each round here. the trace, not the vibe.';
    refreshModeBadge();
    refreshDuetSelects();
    $('optLedger').checked = localStorage.getItem('dukelab-no-ledger') === '1';
    $('optLedger').onchange = () => localStorage.setItem('dukelab-no-ledger', $('optLedger').checked ? '1' : '0');
    $('workerUrl').value = Fleet.url;
    // deep-linking: ?autorun=1 runs the argument on load; ?round=4 jumps
    const q = new URLSearchParams(location.search);
    if (q.get('seed')) $('seedInput').value = q.get('seed');
    if (q.get('artist') && E.ARTISTS[q.get('artist')]) {
      S.artist = q.get('artist');
      $('artistChips').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.artist === S.artist));
    }
    if (q.get('persona') && E.PERSONAS[q.get('persona')]) {
      S.persona = q.get('persona');
      $('personaChips').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.persona === S.persona));
      $('personaName').textContent = E.PERSONAS[S.persona].name;
    }
    if (q.has('uitest')) {
      // headless self-test: exercises workshop + bandstand, reports in <title>
      setTimeout(async () => {
        const out = [];
        try {
          $('shopMusician').value = 'a noir trumpeter who answers in shadows';
          await $('btnMakeMusician').onclick();
          const mChips = $('artistChips').querySelectorAll('.chip').length;
          const mOk = mChips === 4 && S.artist.startsWith('m:') && !!E.ARTISTS[S.artist];
          out.push(mOk ? 'musician:ok' : 'musician:FAIL chips=' + mChips);
          $('shopJudge').value = 'a critic who only forgives space and swing';
          await $('btnMakeJudge').onclick();
          const jOk = $('personaChips').querySelectorAll('.chip').length === 5 && S.persona.startsWith('j:');
          out.push(jOk ? 'judge:ok' : 'judge:FAIL');
          $('duetB').value = S.matured ? S.matured.key : $('duetB').value;
          $('btnDuet').onclick();
          const dOk = S.duet && S.duet.events.length > 40 && $('banterLog').textContent.includes('banter');
          out.push(dOk ? 'duet:ok quotes=' + S.duet.quotes : 'duet:FAIL');
          // run a custom-musician argument end-to-end
          $('seedInput').value = 'uitest/1';
          await doRun(8);
          const rOk = S.run && S.run.verdict && $('runMeta').textContent.includes('seed uitest/1');
          out.push(rOk ? 'run:ok ' + S.run.verdict.status : 'run:FAIL');
          out.push('duet-voices:' + (S.duet.events.some(e => e.voice === 'melody2') ? 'ok' : 'FAIL'));
        } catch (e) { out.push('EX:' + e.message); }
        const bad = out.some(x => x.includes('FAIL') || x.startsWith('EX'));
        document.title = 'UITEST ' + (bad ? 'FAIL' : 'PASS') + ' | ' + out.join(' ');
      }, 800);
    }
    if (q.has('round')) { S.pendingNudges = {}; doRun(8).then(() => selectRound(Math.min(+q.get('round') || 0, (S.run ? S.run.rounds.length - 1 : 0)))); }
    else if (q.get('autorun')) { S.pendingNudges = {}; doRun(8); }
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); if (S.playing) Audio.stop(); else if (currentRound()) Audio.play(0); }
    });
  });
})();
