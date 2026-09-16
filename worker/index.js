/* ============================================================================
   DUKE LAB — Cloudflare Worker
   The fleet behind the instrument. Static assets (the site) are served by the
   Workers Assets binding from ./public; these routes power the live mode:

     GET  /health        → mode badge handshake
     POST /api/ask       → free-text desire → 16-feature deltas (LLM)
     POST /api/round     → take + critiques → critic prose, LLM-polished
     GET  /api/targets   → artist centroids (today static; swap in Vectorize)
     POST /api/compile   → stretch: pipe .song through real plainsong → MIDI

   Env: set OPENAI_API_KEY (any OpenAI-compatible endpoint via OPENAI_BASE_URL)
   or bind an AI Gateway. Without a key, /api/ask degrades honestly to the
   same local lexicon the browser ships — never a 502, honesty has a floor.
   ========================================================================== */

const CENTS = {
  duke: { name: 'DUKE ELLINGTON', centroid: { registerSpread: .78, trebleActivity: .72, dynRange: .55, dynContour: .62, swingFeel: .62, syncopation: .70, downbeatWeight: .45, harmonicComplex: .82, chromaticism: .58, repetition: .38, callReply: .80, density: .62, phraseVariance: .60, restRatio: .30, bassMovement: .78, cadenceRegular: .50 } },
  evans: { name: 'BILL EVANS', centroid: { registerSpread: .80, trebleActivity: .48, dynRange: .88, dynContour: .90, swingFeel: .48, syncopation: .45, downbeatWeight: .40, harmonicComplex: .92, chromaticism: .72, repetition: .22, callReply: .55, density: .52, phraseVariance: .42, restRatio: .66, bassMovement: .35, cadenceRegular: .30 } },
  monk: { name: 'THELONIOUS MONK', centroid: { registerSpread: .55, trebleActivity: .40, dynRange: .85, dynContour: .78, swingFeel: .50, syncopation: .82, downbeatWeight: .18, harmonicComplex: .78, chromaticism: .68, repetition: .74, callReply: .75, density: .38, phraseVariance: .85, restRatio: .72, bassMovement: .30, cadenceRegular: .18 } },
};

const LEX = [
  [/mood|dark|brood|shadow|sad/i, { restRatio: +0.12, dynRange: +0.08, chromaticism: +0.06 }],
  [/bright|light|lift|up|hope/i, { registerSpread: +0.10, trebleActivity: +0.08, dynRange: -0.04 }],
  [/space|sparse|air|room/i, { restRatio: +0.15, density: -0.12 }],
  [/busy|dense|fill/i, { density: +0.15, restRatio: -0.08 }],
  [/swing|groove|lay back|pocket/i, { swingFeel: +0.14, syncopation: +0.06 }],
  [/straight|square|rigid/i, { swingFeel: -0.14, downbeatWeight: +0.10 }],
  [/angular|jagged|weird|odd/i, { syncopation: +0.10, phraseVariance: +0.10, downbeatWeight: -0.08 }],
  [/simple|plain/i, { harmonicComplex: -0.12, chromaticism: -0.06, repetition: +0.08 }],
  [/rich|complex|color|harmon/i, { harmonicComplex: +0.14, chromaticism: +0.06 }],
  [/repeat|cell|motif|hook/i, { repetition: +0.15 }],
  [/high|top|upper/i, { registerSpread: +0.10, trebleActivity: +0.12 }],
  [/low|bottom|bass/i, { registerSpread: -0.06, bassMovement: +0.10 }],
  [/soft|quiet|gentle|hush/i, { dynRange: -0.10, dynContour: -0.06, restRatio: +0.06 }],
  [/loud|aggress|attack|drive/i, { dynRange: +0.12, dynContour: +0.10, downbeatWeight: +0.06 }],
];

function localAsk(text) {
  const delta = {}; let hits = 0;
  for (const [re, d] of LEX) if (re.test(text)) { hits++; for (const [k, v] of Object.entries(d)) delta[k] = (delta[k] || 0) + v; }
  for (const k of Object.keys(delta)) delta[k] = Math.max(-0.3, Math.min(0.3, delta[k]));
  return { delta, matched: hits, source: 'local-lexicon' };
}

const ASK_SCHEMA = `Return JSON only: {"delta": {"<featureId>": <number -0.3..0.3>}, "matched": <int>}. Feature ids: registerSpread trebleActivity dynRange dynContour swingFeel syncopation downbeatWeight harmonicComplex chromaticism repetition callReply density phraseVariance restRatio bassMovement cadenceRegular. Interpret the musician's words as adjustments toward/away from the ${'${artist}'} centroid. Small deltas; a musician nudges, he does not teleport.`;

async function llm(env, system, user) {
  const base = env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const key = env.OPENAI_API_KEY;
  if (!key) return null;
  const r = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.choices?.[0]?.message?.content || null;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    const json = (x, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });

    if (req.method === 'OPTIONS') return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST,GET', 'access-control-allow-headers': 'content-type' } });

    if (p === '/health') return json({ ok: true, mode: 'live-fleet', worker: 'duke-lab', time: new Date().toISOString() });

    if (p === '/api/targets') return json({ artists: CENTS, note: 'static centroids; bind Vectorize for a corpus-derived canon' });

    if (p === '/api/ask' && req.method === 'POST') {
      const { text, artist = 'duke' } = await req.json().catch(() => ({}));
      if (!text) return json({ error: 'text required' }, 400);
      const art = CENTS[artist] || CENTS.duke;
      const raw = await llm(env,
        'You are the gardener in a GAN-with-words music lab. ' + ASK_SCHEMA.replace('${artist}', art.name) + ' Centroid: ' + JSON.stringify(art.centroid),
        `The operator says: "${text}"`);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const delta = {}; let n = 0;
          for (const [k, v] of Object.entries(parsed.delta || {})) {
            if (CENTS.duke.centroid[k] === undefined) continue;
            delta[k] = Math.max(-0.3, Math.min(0.3, +v || 0)); if (delta[k]) n++;
          }
          if (n) return json({ delta, matched: parsed.matched ?? n, source: 'fleet-ear', model: env.OPENAI_MODEL || 'gpt-4o-mini' });
        } catch { /* fall through */ }
      }
      return json(localAsk(text)); // honesty floor
    }

    if (p === '/api/round' && req.method === 'POST') {
      const { song, critiques, persona, artist } = await req.json().catch(() => ({}));
      if (!song) return json({ error: 'song required' }, 400);
      const system = `You are ${persona || 'THE PURIST'}, a harsh critic ear in a music lab growing ${(CENTS[artist] || CENTS.duke).name} takes. Given a plainsong take and measured critiques, write ONE sentence of verdict prose in the voice of a record-date critic: precise, barbed, concrete. No flattery. If the take is close, say you can no longer tell if it's a song you simply haven't heard. Return JSON: {"verdict": "<sentence>"}`;
      const raw = await llm(env, system, JSON.stringify({ critiques: critiques || [], song: String(song).slice(0, 3000) }));
      if (raw) { try { return json({ ...JSON.parse(raw), source: 'fleet-ear' }); } catch { } }
      return json({ verdict: (critiques && critiques[0] && critiques[0].line) || 'the take stands unjudged.', source: 'local' });
    }

    if (p === '/api/compile' && req.method === 'POST') {
      // Stretch: run the take through the real plainsong compiler. On
      // Cloudflare this wants a Python Worker (workers-py) wrapping
      // SuperInstance/plainsong. Until then: honest 501 with the local path.
      return json({ error: 'not deployed', howto: 'pip install plainsong && plainsong compile take.song — or run the worker-python shim from docs/COMPILE.md' }, 501);
    }

    // static assets are served by the Assets binding automatically.
    return env.ASSETS ? env.ASSETS.fetch(req) : new Response('duke-lab worker: asset binding not configured', { status: 404 });
  },
};
