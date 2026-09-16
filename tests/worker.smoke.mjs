// Worker smoke test — mocks env, exercises every route incl. rate limit.
const w = await import('/tmp/duke-lab/worker/index.js');
const env = {}; // no key, no DB, no vectorize — the honesty floor
let pass = 0, fail = 0;
const t = (name, cond) => { cond ? (pass++, console.log('  ok ', name)) : (fail++, console.log('  FAIL', name)); };
const call = (path, body, method) => w.default.fetch(new Request('https://w.example' + path, {
  method: method || (body ? 'POST' : 'GET'),
  headers: { 'content-type': 'application/json' },
  body: body ? JSON.stringify(body) : undefined,
}), env).then(async r => ({ status: r.status, j: await r.json() }));

console.log('== worker smoke (bare env) ==');
let r = await call('/health');
t('health degrades honestly', r.j.ok && r.j.mode === 'local fallback' && r.j.db === false && r.j.vec16 === false);

r = await call('/api/ask', { text: 'a moodier, spacious ballad with lots of swing' });
t('ask local fallback fires', r.j.ok && r.j.source === 'local-fallback' && Math.abs(r.j.delta.restRatio) > 0);

r = await call('/api/musician', { description: 'a noir trumpeter who plays in shadows and only answers back' });
t('local musician designed', r.j.ok && r.j.musician.name.length > 3 && r.j.musician.centroid.restRatio > 0.3 && r.j.persisted === false);
t('musician id + source', /^m_/.test(r.j.musician.id) && r.j.musician.source === 'local-fallback');
const mid = r.j.musician.id, mname = r.j.musician.name;

r = await call('/api/judge', { description: 'a critic who only cares about space, swing feel, and whether the bass moves' });
t('local judge coded', r.j.ok && r.j.judge.weights.restRatio > 1 && r.j.judge.weights.bassMovement > 1);

r = await call('/api/judge', { description: 'x' });
t('tiny input still yields a judge that cares', r.j.ok && Object.keys(r.j.judge.weights).length >= 2);

r = await call('/api/learn', { seed: 'smoke/1', verdict: 'CONVERGED', rounds: 6, sigma: 0.11, canon: 'duke', judge: 'purist', asks: ['moodier'], finalParams: { restRatio: .6, swingFeel: .7 }, musicianName: 'SMOKE EVOLVED' });
t('learn ingests run + graduates evolved musician', r.j.ok && r.j.persisted === false && r.j.musician && r.j.musician.source === 'evolved');

r = await call('/api/learn', { seed: 'x' });
t('learn validates payload', r.status === 400);

r = await call('/api/ledger');
t('ledger honest without DB', r.j.ok && r.j.runs === 0 && r.j.persisted === false);

r = await call('/api/musicians');
t('musicians list honest without DB', r.j.ok && r.j.musicians.length === 0);

r = await call('/api/musicians/similar?vec=' + Array(16).fill('0.5').join(','));
t('similar runs, indexed=false', r.j.ok && r.j.indexed === false);
r = await call('/api/musicians/similar?vec=1,2');
t('similar validates dims', r.status === 400);

console.log('== liberal rate limit (45/min) ==');
let last = null, limited = 0;
for (let i = 0; i < 50; i++) { last = await call('/health'); if (last.status === 429) limited++; }
t('429s engage inside the window', limited > 0 && limited < 50);
t('429 body is polite', (await call('/health')).j.error ? true : limited === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
