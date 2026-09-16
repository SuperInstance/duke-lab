/* ============================================================================
   DUKE LAB — Cloudflare Worker v2 (the fleet behind the instrument)

   Static assets are served by the Workers Assets binding from ./public.
   These routes power live mode, the workshop, the bandstand, and the ledger:

     GET  /health             → mode badge handshake
     POST /api/ask            → free-text desire → 16-feature deltas (LLM, local fallback)
     POST /api/round          → take + critiques → critic prose (LLM, local fallback)
     GET  /api/targets        → artist centroids
     POST /api/musician       → design a musician: description → {id, name, centroid}
     POST /api/judge          → vibe-code a judge: description → {id, name, weights, floor}
     POST /api/learn          → ingest one finished argument → runs row + evolved musician
     GET  /api/ledger         → fleet aggregates: counts, frontier, recent designs
     GET  /api/musicians      → list designed/evolved musicians (D1)
     GET  /api/musicians/similar?id=…|?vec=a,b,… → nearest musicians (Vectorize, optional)
     POST /api/compile        → stretch: .song → plainsong → MIDI (501 until built)

   THE LEARNING LOOP — musician vectorization:
   Every musician is a point in [0,1]^16 (its feature centroid). Every
   generation helps: each finished argument upserts its matured params as an
   evolved musician. Two Vectorize indexes when bound:
     MUSICIANS_NATIVE    dims=16  — the mathematical musician-space
     MUSICIANS_SEMANTIC  dims=768 — Workers-AI embeddings of descriptions
   Without bindings the worker stays fully honest on D1 alone.

   Env: OPENAI_API_KEY (+ OPENAI_BASE_URL / OPENAI_MODEL), DB (D1),
   MUSICIANS_NATIVE / MUSICIANS_SEMANTIC (Vectorize), AI (Workers AI).
   ========================================================================== */

const CENTS = {
  duke: { name: 'DUKE ELLINGTON', centroid: { registerSpread: .78, trebleActivity: .72, dynRange: .55, dynContour: .62, swingFeel: .62, syncopation: .70, downbeatWeight: .45, harmonicComplex: .82, chromaticism: .58, repetition: .38, callReply: .80, density: .62, phraseVariance: .60, restRatio: .30, bassMovement: .78, cadenceRegular: .50 } },
  evans: { name: 'BILL EVANS', centroid: { registerSpread: .80, trebleActivity: .48, dynRange: .88, dynContour: .90, swingFeel: .48, syncopation: .45, downbeatWeight: .40, harmonicComplex: .92, chromaticism: .72, repetition: .22, callReply: .55, density: .52, phraseVariance: .42, restRatio: .66, bassMovement: .35, cadenceRegular: .30 } },
  monk: { name: 'THELONIOUS MONK', centroid: { registerSpread: .55, trebleActivity: .40, dynRange: .85, dynContour: .78, swingFeel: .50, syncopation: .82, downbeatWeight: .18, harmonicComplex: .78, chromaticism: .68, repetition: .74, callReply: .75, density: .38, phraseVariance: .85, restRatio: .72, bassMovement: .30, cadenceRegular: .18 } },
};
const FEATURES = Object.keys(CENTS.duke.centroid);
const PROGRESSION_KEYS = ['duke', 'evans', 'monk'];

const LEX = [
  [/mood|dark|brood|shadow|sad|noir/i, { restRatio: +0.12, dynRange: +0.08, chromaticism: +0.06 }],
  [/bright|light|lift|up|hope/i, { registerSpread: +0.10, trebleActivity: +0.08, dynRange: -0.04 }],
  [/space|sparse|air|room|silence/i, { restRatio: +0.15, density: -0.12 }],
  [/busy|dense|fill/i, { density: +0.15, restRatio: -0.08 }],
  [/swing|groove|lay back|pocket/i, { swingFeel: +0.14, syncopation: +0.06 }],
  [/straight|square|rigid/i, { swingFeel: -0.14, downbeatWeight: +0.10 }],
  [/angular|jagged|weird|odd|abstruse/i, { syncopation: +0.10, phraseVariance: +0.10, downbeatWeight: -0.08 }],
  [/simple|plain|bare/i, { harmonicComplex: -0.12, chromaticism: -0.06, repetition: +0.08 }],
  [/rich|complex|color|harmon/i, { harmonicComplex: +0.14, chromaticism: +0.06 }],
  [/repeat|cell|motif|hook|obsess/i, { repetition: +0.15 }],
  [/high|top|upper/i, { registerSpread: +0.10, trebleActivity: +0.12 }],
  [/low|bottom|bass/i, { registerSpread: -0.06, bassMovement: +0.10 }],
  [/soft|quiet|gentle|hush|tender/i, { dynRange: -0.10, dynContour: -0.06, restRatio: +0.06 }],
  [/loud|aggress|attack|drive/i, { dynRange: +0.12, dynContour: +0.10, downbeatWeight: +0.06 }],
  [/call|answer|dialog|duet/i, { callReply: +0.14 }],
  [/run|fluid|line|forward/i, { callReply: -0.08, density: +0.06 }],
  [/stop|halt|staccato|abrupt/i, { restRatio: +0.08, downbeatWeight: -0.06, dynContour: +0.08 }],
];

const clamp01 = v => Math.max(0, Math.min(1, +v || 0));
const clampW = v => Math.max(0, Math.min(3, +v || 0));
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' } });
const now = () => new Date().toISOString();
const uid = p => p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

/* ------------------------- liberal rate limiting ------------------------- */
// Generous on purpose: most any GAN work teaches the fleet something.
// Sliding window, 45/min/IP, per-isolate. Upgrade to Durable Objects when
// the fleet outgrows a single isolate's memory (it will, happily).
const HITS = new Map();
function rateOk(ip) {
  const t = Date.now(), w = HITS.get(ip) || [];
  const live = w.filter(x => t - x < 60_000);
  if (live.length >= 45) { HITS.set(ip, live); return false; }
  live.push(t); HITS.set(ip, live);
  return true;
}

/* ------------------------------- LLM core -------------------------------- */
async function llm(env, system, user, wantJson) {
  const key = env.OPENAI_API_KEY;
  if (!key) return null;
  const base = env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = env.OPENAI_MODEL || 'gpt-4o-mini';
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(base + '/chat/completions', {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model, temperature: 0.8, max_tokens: 700,
        response_format: wantJson ? { type: 'json_object' } : undefined,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.choices?.[0]?.message?.content || null;
  } catch { return null; } finally { clearTimeout(to); }
}
function extractJson(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

/* --------------------------- local fallbacks ----------------------------- */
// Honesty floor: without the key we still design — deterministically from the
// same lexicon the browser ships, named from the visitor's own words.
function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }

function localAsk(text) {
  const delta = {}; FEATURES.forEach(f => (delta[f] = 0));
  let hits = 0;
  LEX.forEach(([re, d]) => { if (re.test(text)) { hits++; Object.entries(d).forEach(([k, v]) => (delta[k] += v)); } });
  return { delta: Object.fromEntries(Object.entries(delta).map(([k, v]) => [k, +Math.max(-0.3, Math.min(0.3, v)).toFixed(3)])), matched: hits };
}

function nameFrom(text, prefix) {
  const words = (text.replace(/[^a-z' ]/gi, ' ').split(/\s+/).filter(w => w.length > 2 && !/^(the|and|with|who|that|plays|like)$/i.test(w)));
  if (!words.length) return prefix + ' ' + (fnv(text) % 997);
  const pick = words.slice(0, 2).map(w => w.toUpperCase());
  return pick.length === 2 ? pick[0] + ' ' + pick[1] : prefix + ' ' + pick[0];
}

function localMusician(text) {
  const { delta } = localAsk(text);
  const centroid = {};
  FEATURES.forEach(f => (centroid[f] = clamp01(CENTS.duke.centroid[f] + (delta[f] || 0))));
  return { name: nameFrom(text, 'THE SAILOR'), blurb: 'Designed from: "' + text.slice(0, 90) + '"', centroid, progression: 'duke' };
}

function localJudge(text) {
  const { delta } = localAsk(text);
  const weights = {};
  FEATURES.forEach(f => { const w = 1 + Math.abs(delta[f] || 0) * 8; if (w > 1.15) weights[f] = +w.toFixed(2); });
  if (!Object.keys(weights).length) { weights.restRatio = 1.8; weights.dynContour = 1.4; } // a judge must care about something
  return { name: nameFrom(text, 'THE CRITIC'), weights, floor: 0, voice: 'leans on whatever the words lean on' };
}

/* --------------------------- design prompts ------------------------------ */
const MUSICIAN_SYS = `You design jazz musicians as measurable 16-feature profiles for a GAN-with-words engine.
Reply in JSON only: {"name": "…", "blurb": "one line", "centroid": {…16 keys…}, "progression": "duke"|"evans"|"monk"}
Feature keys and sane ranges:
registerSpread .2-.9 (how wide the line roams), trebleActivity .1-.9, dynRange .2-.95, dynContour .2-.95,
swingFeel .1-.9, syncopation .1-.9, downbeatWeight .1-.9, harmonicComplex .2-.95, chromaticism .1-.85,
repetition .1-.85, callReply .2-.9, density .2-.85, phraseVariance .2-.9, restRatio .1-.8,
bassMovement .2-.9, cadenceRegular .1-.8.
Translate the DESCRIPTION into a coherent centroid — a musician, not a bag of adjectives. Values in [0,1].`;

const JUDGE_SYS = `You vibe-code loss functions for a jazz GAN. A judge is feature weights — what it punishes.
Reply in JSON only: {"name": "A PERSONA NAME", "weights": {subset of the 16 feature keys}, "floor": 0, "voice": "one line on how it criticizes"}
Feature keys: registerSpread trebleActivity dynRange dynContour swingFeel syncopation downbeatWeight harmonicComplex chromaticism repetition callReply density phraseVariance restRatio bassMovement cadenceRegular
Weights are positive, 0.4–3.0, only on axes this judge actually hears. floor: 0.`;

function validCentroid(c) {
  if (!c || typeof c !== 'object') return null;
  const out = {};
  for (const f of FEATURES) { const v = clamp01(c[f]); if (Number.isNaN(v)) return null; out[f] = v; }
  return out;
}
function validWeights(w) {
  if (!w || typeof w !== 'object') return null;
  const out = {};
  for (const f of Object.keys(w)) {
    if (!FEATURES.includes(f)) continue;
    const v = clampW(w[f]); if (v > 0) out[f] = v;
  }
  return Object.keys(out).length ? out : null;
}

/* ----------------------------- vectorize --------------------------------- */
async function vecUpsert(env, id, values, metadata) {
  if (!env.MUSICIANS_NATIVE) return false;
  try { await env.MUSICIANS_NATIVE.upsert([{ id, values, metadata }]); return true; } catch { return false; }
}
async function vecSemantic(env, id, text, metadata) {
  if (!env.MUSICIANS_SEMANTIC || !env.AI) return false;
  try {
    const emb = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text });
    const v = emb.data?.[0] || emb.data;
    if (!Array.isArray(v)) return false;
    await env.MUSICIANS_SEMANTIC.upsert([{ id, values: v, metadata }]);
    return true;
  } catch { return false; }
}
async function vecQuery(env, index, values, topK) {
  if (!env[index]) return null;
  try {
    const r = await env[index].query(values, { topK: topK || 5, returnMetadata: 'all' });
    return (r.matches || []).map(m => ({ id: m.id, score: +(+m.score).toFixed(4), metadata: m.metadata }));
  } catch { return null; }
}

/* ------------------------------- the worker ------------------------------ */
export default {
  async fetch(req, env) {
    const ip = req.headers.get('cf-connecting-ip') || 'local';
    if (!rateOk(ip)) return json({ ok: false, error: 'rate limit — the bandstand needs a breath. retry in a minute.' }, 429);
    const u = new URL(req.url);
    const p = u.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, GET, OPTIONS' } });

    if (p === '/health') return json({
      ok: true, service: 'duke-lab', mode: env.OPENAI_API_KEY ? 'live ear' : 'local fallback',
      brain: !!env.OPENAI_API_KEY, db: !!env.DB, vec16: !!env.MUSICIANS_NATIVE, vec768: !!env.MUSICIANS_SEMANTIC,
    });

    if (p === '/api/targets') return json({ artists: CENTS });

    if (p === '/api/ask' && req.method === 'POST') {
      const { text } = await req.json().catch(() => ({}));
      if (!text) return json({ ok: false, error: 'text required' }, 400);
      const prompt = `Desire: "${text}"\nFeature deltas in [-0.3, 0.3] as JSON: {"delta": {…16 keys…}, "matched": n}`;
      const j = extractJson(await llm(env, 'You map free-text musical desires to feature deltas for a GAN engine. Reply JSON only.', prompt, true));
      const delta = j && j.delta ? Object.fromEntries(Object.entries(j.delta).map(([k, v]) => [k, +Math.max(-0.3, Math.min(0.3, +v || 0)).toFixed(3)])) : null;
      if (delta) return json({ ok: true, delta, matched: j.matched ?? null, source: 'llm' });
      return json({ ok: true, ...localAsk(text), source: 'local-fallback' });
    }

    if (p === '/api/round' && req.method === 'POST') {
      const { critiques, persona, round } = await req.json().catch(() => ({}));
      const lines = (critiques || []).map(c => c.line).join(' / ') || 'nothing to say';
      const prose = await llm(env, 'You are a jazz critic inside a GAN loop. One sentence, sharp, no flattery.', `Persona: ${persona}. Round ${round}. Critiques: ${lines}`, false);
      return json({ ok: true, prose: prose || `(${persona}) ${lines}` });
    }

    if (p === '/api/compile' && req.method === 'POST') {
      return json({ ok: false, error: 'not built yet — the compile route awaits the plainsong toolchain. see docs/COMPILE.md.' }, 501);
    }

    /* -------- the workshop: design a musician / vibe-code a judge -------- */

    if (p === '/api/musician' && req.method === 'POST') {
      const { description } = await req.json().catch(() => ({}));
      if (!description || !String(description).trim()) return json({ ok: false, error: 'description required' }, 400);
      const text = String(description).slice(0, 500);
      const j = extractJson(await llm(env, MUSICIAN_SYS, `DESCRIPTION: "${text}"`, true));
      const designed = j && j.centroid && validCentroid(j.centroid)
        ? { name: String(j.name || nameFrom(text, 'THE SAILOR')).slice(0, 40).toUpperCase(), blurb: String(j.blurb || '').slice(0, 140), centroid: validCentroid(j.centroid), progression: PROGRESSION_KEYS.includes(j.progression) ? j.progression : 'duke', source: 'llm' }
        : { ...localMusician(text), source: 'local-fallback' };
      const id = uid('m');
      let persisted = false;
      if (env.DB) {
        try {
          await env.DB.prepare(`INSERT INTO musicians (id, name, blurb, description, centroid, progression, source, plays, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`)
            .bind(id, designed.name, designed.blurb, text, JSON.stringify(designed.centroid), designed.progression, designed.source, now()).run();
          persisted = true;
        } catch {}
      }
      await vecUpsert(env, id, FEATURES.map(f => designed.centroid[f]), { name: designed.name, kind: 'designed', source: designed.source });
      await vecSemantic(env, id, designed.name + ' — ' + text, { name: designed.name, kind: 'designed' });
      return json({ ok: true, musician: { id, ...designed }, persisted, vectors: { native: !!env.MUSICIANS_NATIVE, semantic: !!env.MUSICIANS_SEMANTIC } });
    }

    if (p === '/api/judge' && req.method === 'POST') {
      const { description } = await req.json().catch(() => ({}));
      if (!description || !String(description).trim()) return json({ ok: false, error: 'description required' }, 400);
      const text = String(description).slice(0, 500);
      const j = extractJson(await llm(env, JUDGE_SYS, `DESCRIPTION: "${text}"`, true));
      const coded = j && j.weights && validWeights(j.weights)
        ? { name: String(j.name || nameFrom(text, 'THE CRITIC')).slice(0, 40).toUpperCase(), weights: validWeights(j.weights), floor: clamp01(j.floor || 0), voice: String(j.voice || '').slice(0, 120), source: 'llm' }
        : { ...localJudge(text), source: 'local-fallback' };
      const id = uid('j');
      let persisted = false;
      if (env.DB) {
        try {
          await env.DB.prepare(`INSERT INTO judges (id, name, description, weights, floor, voice, source, uses, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`)
            .bind(id, coded.name, text, JSON.stringify(coded.weights), coded.floor, coded.voice, coded.source, now()).run();
          persisted = true;
        } catch {}
      }
      return json({ ok: true, judge: { id, ...coded }, persisted });
    }

    /* -------- the ledger: every generation helps -------- */

    if (p === '/api/learn' && req.method === 'POST') {
      const b = await req.json().catch(() => ({}));
      if (!b.seed || !b.verdict) return json({ ok: false, error: 'seed + verdict required' }, 400);
      const id = uid('r');
      let persisted = false;
      if (env.DB) {
        try {
          await env.DB.prepare(`INSERT INTO runs (id, seed, canon, judge, verdict, rounds, sigma, asks, banter, created_at, ip)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(id, String(b.seed).slice(0, 80), String(b.canon || '').slice(0, 60), String(b.judge || '').slice(0, 60),
              String(b.verdict).slice(0, 20), +b.rounds || 0, +b.sigma || 0, JSON.stringify(b.asks || []),
              b.banter == null ? null : +b.banter, now(), fnv(ip)).run();
          persisted = true;
        } catch {}
      }
      // matured musicians graduate into the index: the generator's own output
      // becomes searchable musician-space. every generation helps.
      let musician = null;
      if (b.finalParams && typeof b.finalParams === 'object') {
        const v = FEATURES.map(f => clamp01(b.finalParams[f]));
        const mid = uid('g');
        musician = { id: mid, name: String(b.musicianName || 'EVOLVED ' + String(b.seed).split('/')[0].toUpperCase()).slice(0, 40), params: b.finalParams, source: 'evolved' };
        if (env.DB) {
          try {
            await env.DB.prepare(`INSERT INTO musicians (id, name, blurb, description, centroid, progression, source, plays, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`)
              .bind(mid, musician.name, 'Evolved by the argument from seed ' + b.seed, String(b.asks || []).slice(0, 200), JSON.stringify(Object.fromEntries(FEATURES.map((f, i) => [f, v[i]]))), 'duke', 'evolved', now()).run();
          } catch {}
        }
        await vecUpsert(env, mid, v, { name: musician.name, kind: 'evolved', seed: b.seed, verdict: b.verdict });
      }
      return json({ ok: true, persisted, musician });
    }

    if (p === '/api/ledger') {
      const base = { ok: true, runs: 0, musicians: 0, judges: 0, avgSigma: null, persisted: false, recent: [] };
      if (!env.DB) return json(base);
      try {
        const [runs, musicians, judges, sig, recent] = await Promise.all([
          env.DB.prepare('SELECT COUNT(*) n FROM runs').first(),
          env.DB.prepare('SELECT COUNT(*) n FROM musicians').first(),
          env.DB.prepare('SELECT COUNT(*) n FROM judges').first(),
          env.DB.prepare('SELECT AVG(sigma) s FROM runs WHERE sigma > 0').first(),
          env.DB.prepare('SELECT id, name, source FROM musicians ORDER BY created_at DESC LIMIT 6').all(),
        ]);
        base.runs = runs?.n || 0; base.musicians = musicians?.n || 0; base.judges = judges?.n || 0;
        base.avgSigma = sig?.s == null ? null : +(+sig.s).toFixed(4);
        base.recent = recent?.results || []; base.persisted = true;
      } catch {}
      return json(base);
    }

    if (p === '/api/musicians') {
      if (!env.DB) return json({ ok: true, musicians: [], persisted: false });
      try {
        const { results } = await env.DB.prepare('SELECT id, name, source, plays, created_at FROM musicians ORDER BY created_at DESC LIMIT 50').all();
        return json({ ok: true, musicians: results || [], persisted: true });
      } catch { return json({ ok: true, musicians: [], persisted: false }); }
    }

    if (p === '/api/musicians/similar') {
      const id = u.searchParams.get('id');
      const vec = u.searchParams.get('vec');
      let values = null;
      if (vec) values = String(vec).split(',').map(Number).slice(0, 16);
      else if (id && env.DB) {
        try {
          const row = await env.DB.prepare('SELECT centroid FROM musicians WHERE id = ?').bind(id).first();
          if (row?.centroid) values = FEATURES.map(f => clamp01(JSON.parse(row.centroid)[f]));
        } catch {}
      }
      if (!values || values.length !== 16 || values.some(Number.isNaN)) return json({ ok: false, error: 'id or vec (16 comma floats) required' }, 400);
      const matches = await vecQuery(env, 'MUSICIANS_NATIVE', values, 6);
      return json({ ok: true, matches: matches || [], indexed: !!env.MUSICIANS_NATIVE });
    }

    return json({ ok: false, error: 'not found' }, 404);
  },
};
