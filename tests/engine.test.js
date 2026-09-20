/* Node test harness for engine.js — the honesty must be verifiable. */
const E = require('../engine.js');
let pass = 0, fail = 0;
function t(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

console.log('== determinism ==');
const r1 = E.runArgument({ seed: 'valley/night-8', artist: 'duke', persona: 'purist', maxRounds: 5 });
const r2 = E.runArgument({ seed: 'valley/night-8', artist: 'duke', persona: 'purist', maxRounds: 5 });
t('same seed → same first take song', r1.rounds[0].song === r2.rounds[0].song);
t('same seed → same sigma sequence', r1.rounds.map(r => r.sigma).join() === r2.rounds.map(r => r.sigma).join());
t('different seed → different take', (() => { const r3 = E.runArgument({ seed: 'other-seed', artist: 'duke', maxRounds: 2 }); return r3.rounds[0].song !== r1.rounds[0].song; })());

console.log('== the argument converges in ratio ==');
const run = E.runArgument({ seed: 'cresleigh/8th', artist: 'duke', persona: 'engineer', maxRounds: 8, convergence: 0.07 });
t('produces ≥4 rounds', run.rounds.length >= 4, 'got ' + run.rounds.length);
t('verdict present', run.verdict && ['CONVERGED', 'HONEST GAP'].includes(run.verdict.status));
const sigmas = run.rounds.map(r => r.sigma);
t('argument makes progress (min sigma well below first)', Math.min(...sigmas) < sigmas[0] * 0.85,
  `first=${sigmas[0]} min=${Math.min(...sigmas)}`);
t('final sigma near or below first (no blowup)', sigmas[sigmas.length - 1] <= sigmas[0] + 0.05,
  `${sigmas[0]} → ${sigmas[sigmas.length - 1]}`);
t('critique count shrinks by golden rule', run.rounds[1].critiques.length <= run.rounds[0].critiques.length);
console.log('    sigma path: ' + sigmas.join(' → '));
// the argument must behave across seeds, artists, personas — not one lucky roll
let progressCount = 0; const N = 12;
for (const [s, a, p] of [['a','duke','purist'],['b','evans','romantic'],['c','monk','historian'],['d','duke','engineer'],['e','evans','purist'],['f','monk','engineer'],['g','duke','historian'],['h','evans','engineer'],['i','monk','romantic'],['j','duke','purist'],['k','evans','historian'],['l','monk','purist']]) {
  const rr = E.runArgument({ seed: 'sweep/' + s, artist: a, persona: p, maxRounds: 8, convergence: 0.08 });
  const ss = rr.rounds.map(x => x.sigma);
  if (Math.min(...ss) < Math.min(ss[0], 0.16) - 0.008 && ss[ss.length - 1] <= ss[0] + 0.05) progressCount++;
}
t('12-seed sweep: all runs make progress', progressCount === N, progressCount + '/' + N);

console.log('== feature sanity ==');
const f = run.rounds[0].features;
t('16 features, all 0..1', f.length === 16 && f.every(x => x >= 0 && x <= 1), JSON.stringify(f.map(x => +x.toFixed(2))));
const ev = run.rounds[0].events;
t('events sorted by time', ev.every((e, i) => i === 0 || ev[i - 1].t <= e.t));
t('velocities clamped 30..110', ev.filter(e => e.voice === 'melody').every(e => e.vel >= 30 && e.vel <= 110));
t('16 bars covered', new Set(ev.map(e => e.bar)).size === 16);

console.log('== plainsong contract ==');
const song = run.rounds[0].song;
t('has TRACK header', song.includes('**TRACK:'));
t('has Chords row', /Chords: \|/.test(song));
t('has Melody row with vel (one vel per row)', /Melody:.*vel: \d+/.test(song));
t('has @bass row', /@bass:.*vel: \d+/.test(song));
t('swing percent matches params', song.includes(`swing: ${Math.round(run.rounds[0].params.swingFeel * 100)}%`));

console.log('== personas are swappable loss functions ==');
const pe = E.critiqueRound(run.rounds[0].features, E.ARTISTS.duke.centroid, 'engineer', 0);
const pr = E.critiqueRound(run.rounds[0].features, E.ARTISTS.duke.centroid, 'romantic', 0);
t('engineer attacks dynamics first', pe.critiques[0].label.match(/DYNAMIC|REGISTER|TREBLE/));
t('romantic attacks space/contour first', pr.critiques[0].label.match(/REST|CONTOUR|CALL|PHRASE/));

console.log('== free-text ask ==');
const ask = E.parseAsk('make it moodier, more space, darker');
t('mood+space lexicon fires', ask.matched >= 2, 'matched ' + ask.matched);
t('restRatio rises', ask.delta.restRatio > 0.1);
const nudged = E.runArgument({ seed: 'nudge-test', artist: 'evans', persona: 'romantic', maxRounds: 3, nudges: { 1: ask.delta } });
t('nudge run completes', nudged.verdict && nudged.rounds.length >= 3);

console.log('== midi export ==');
const midi = E.toMidi(run.rounds[0].events, 96);
t('MThd header', midi[0] === 0x4d && midi[1] === 0x54 && midi[2] === 0x68 && midi[3] === 0x64);
t('track chunk present', midi.includes(0x4d) && midi.length > 200, 'bytes=' + midi.length);
const len = (midi[18] << 24 | midi[19] << 16 | midi[20] << 8 | midi[21]) >>> 0;
t('declared track length consistent', len === midi.length - 22, `${len} vs ${midi.length - 22}`);

console.log('== artist centroids differ ==');
const a = E.ARTISTS;
t('monk most anti-downbeat', a.monk.centroid.downbeatWeight < a.duke.centroid.downbeatWeight - 0.2);
t('evans broods most on rests', a.evans.centroid.restRatio > a.duke.centroid.restRatio && a.monk.centroid.restRatio > a.evans.centroid.restRatio);

console.log('== the workshop: designed musicians ==');
E.registerArtist('m:t1', { name: 'TEST SAILOR', centroid: { registerSpread:.7, trebleActivity:.5, dynRange:.8, dynContour:.7, swingFeel:.6, syncopation:.5, downbeatWeight:.4, harmonicComplex:.6, chromaticism:.4, repetition:.3, callReply:.7, density:.5, phraseVariance:.6, restRatio:.5, bassMovement:.6, cadenceRegular:.4 } });
t('registered artist visible', E.ARTISTS['m:t1'].name === 'TEST SAILOR');
t('registered artist calibrates', Array.isArray(E.effectiveCentroid('m:t1')) && E.effectiveCentroid('m:t1').length === 16);
const crun = E.runArgument({ seed: 'w/1', artist: 'm:t1', maxRounds: 8, convergence: 0.125 });
t('designed musician runs', crun.rounds.length >= 2 && !!crun.verdict);
t('designed musician keeps its canon', Math.abs(crun.effective[E.FEATURES[0].id] - E.effectiveCentroid('m:t1')[0]) < 1e-9);

console.log('== vibe-coded judges ==');
E.registerPersona('j:t1', { name: 'TEST BOATSWAIN', weights: { restRatio: 2.0, swingFeel: 1.5, bassMovement: 1.4 } });
const jrun = E.runArgument({ seed: 'w/2', artist: 'duke', persona: 'j:t1', maxRounds: 8, convergence: 0.125 });
t('vibe-coded judge heard by name', E.PERSONAS[jrun.persona].name === 'TEST BOATSWAIN');
t('vibe-coded judge changes the argument', jrun.rounds[0].persona === 'j:t1');

console.log('== the bandstand: duets ==');
const d1 = E.runDuet({ seed: 'b/1', a: 'duke', b: 'monk', phrases: 4 });
t('duet returns both voices', d1.events.some(e => e.voice === 'melody') && d1.events.some(e => e.voice === 'melody2'));
t('duet spans its beats', d1.beats === 32 && d1.events.every(e => e.t < d1.beats));
t('duet banter scored', d1.quotes >= 0 && d1.banter >= 0 && d1.banter <= 1);
const d1b = E.runDuet({ seed: 'b/1', a: 'duke', b: 'monk', phrases: 4 });
t('duet deterministic', JSON.stringify(d1.events) === JSON.stringify(d1b.events) && d1.quotes === d1b.quotes);
const d2 = E.runDuet({ seed: 'b/2', a: 'm:t1', b: 'evans', phrases: 3 });
t('designed musicians can duet', d2.phrases.length === 3 && d2.a === 'TEST SAILOR');
t('duet song names both', d2.song.includes('×'));

console.log('== listens knob (σ measurement averaging) ==');
// the queue-called "takes" knob: how many measurement repetitions the referee
// averages per round before judging σ. Default 5 = pre-patch behavior, bit-identical.
const ldDef = E.runArgument({ seed: 'listens/default', maxRounds: 2 });
const ldExp = E.runArgument({ seed: 'listens/default', maxRounds: 2, listens: 5 });
t('default (no option) === explicit listens:5', ldDef.listens === 5 &&
  ldDef.rounds.map(r => r.sigma).join() === ldExp.rounds.map(r => r.sigma).join() &&
  ldDef.rounds[0].song === ldExp.rounds[0].song);
const lf1 = E.runArgument({ seed: 'listens/floor', artist: 'monk', persona: 'purist', maxRounds: 0, jitter: 0, listens: 1 });
const lf80 = E.runArgument({ seed: 'listens/floor', artist: 'monk', persona: 'purist', maxRounds: 0, jitter: 0, listens: 80 });
t('jitter=0 noise floor drops with averaging', lf80.rounds[0].sigma < lf1.rounds[0].sigma,
  `listens=1 → ${lf1.rounds[0].sigma}, listens=80 → ${lf80.rounds[0].sigma}`);
t('floor is bias-bound, not noise-bound: even listens=80 stays ≥ 0.10 (0.08 unreachable by averaging)',
  lf80.rounds[0].sigma >= 0.10, 'got ' + lf80.rounds[0].sigma);
t('listens clamped into 1..64', (() => {
  const c0 = E.runArgument({ seed: 'listens/clamp', maxRounds: 0, listens: 0 });
  const c99 = E.runArgument({ seed: 'listens/clamp', maxRounds: 0, listens: 999 });
  return c0.listens === 1 && c99.listens === 64;
})());
const ldet1 = E.runArgument({ seed: 'listens/det', maxRounds: 1, listens: 4 });
const ldet2 = E.runArgument({ seed: 'listens/det', maxRounds: 1, listens: 4 });
t('listens determinism (same seed + same N → identical σ)', ldet1.rounds.map(r => r.sigma).join() === ldet2.rounds.map(r => r.sigma).join());

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
