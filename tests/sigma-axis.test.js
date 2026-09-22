/* σ axis decomposition — deterministic pins for docs/SIGMA_AXIS_DECOMPOSITION.md.
 *
 * The expensive per-row numbers are reproduced by qa/axis-decomposition.js
 * (endpoints = honest-descent-table endpoints). This harness pins the
 * structural findings at a cost the suite can afford: evans residual is
 * ~all on medium-residue axes (wall a), monk's #1 slice is a ZERO-medium-gap
 * axis (wall b — realization failure), and the doc's row count is 8.
 */
const E = require('../engine.js');
const { decomposeRow } = require('../qa/axis-decomposition.js');
let pass = 0, fail = 0;
function t(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

const QUICK = process.argv.includes('--quick');
const artists = QUICK ? ['evans'] : ['evans', 'monk'];
const rows = [];
for (const a of artists) for (const p of Object.keys(E.PERSONAS)) rows.push(decomposeRow(a, p));

console.log('== evans: residual is on the medium’s axes (wall a) ==');
for (const r of rows.filter(r => r.artist === 'evans')) {
  t(`${r.artist}/${r.persona} σ² on residue axes ≥ 90%`, r.onResidue >= 0.90, (r.onResidue * 100).toFixed(1) + '%');
  t(`${r.artist}/${r.persona} top-3 axes all carry medium gaps`, r.wallA.length === 3, r.wallA.length + '/3');
}

console.log('== monk: the #1 slice has NO medium gap (wall b) ==');
for (const r of rows.filter(r => r.artist === 'monk')) {
  const top2 = r.top3.slice(0, 2);
  const zeroGapLeader = top2.find(d => d.medGap < 0.05);
  t(`${r.artist}/${r.persona} a top-2 axis has medGap < 0.05`, !!zeroGapLeader,
    top2.map(d => `${d.id}:${d.medGap.toFixed(3)}`).join(' '));
  t(`${r.artist}/${r.persona} σ² on residue axes ≤ 70%`, r.onResidue <= 0.70, (r.onResidue * 100).toFixed(1) + '%');
}

console.log('== row census ==');
{
  const all = QUICK ? 4 : 8;
  t(`doc row count is ${all} (2 artists × 4 personas)`, rows.length === all, rows.length + ' rows');
  const r = rows.find(x => x.artist === 'evans' && x.persona === 'purist');
  t('evans/purist #1 axis is density', r.top3[0].id === 'density', r.top3[0].id);
  t('evans/purist audited σ ≈ 0.089 (shipped-table endpoint re-read)', Math.abs(r.audited - 0.0890) < 0.001, r.audited.toFixed(4));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
