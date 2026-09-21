/* Node test harness for jev-receipts.js — the honesty must be verifiable. */
const E = require('../engine.js');
const J = require('../jev-receipts.js');
let pass = 0, fail = 0;
function t(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

// pinned cross-language vector (jev-quilt PR #3): bytes, not characters
t('fnv1a UTF-8 pin: café Δ 日本語 → 0x024a555471370b18d (numeric, per jev-quilt)',
  J.fnv1a('café Δ 日本語') === BigInt('0x024a555471370b18d'),
  J.hex(J.fnv1a('café Δ 日本語')));
t('fnv1a ASCII stable', J.fnv1a('abc') === J.fnv1a('abc') && J.fnv1a('abc') !== J.fnv1a('abd'));

// chain integrity + tamper evidence
{
  const c = new J.ReceiptChain();
  c.book('jev.reading', { cell: 'sigma', t: 0, value: 0.15, alarmed: false });
  c.book('jev.alarm', { cell: 'sigma', t: 1, value: 0.22, alarmed: true });
  t('chain verifies fresh', c.verify() === true);
  const saved = c.entries[0].body;
  c.entries[0].body = saved.replace('0.15', '0.05'); // quiet the reading retroactively
  t('payload tamper breaks verify', c.verify() === false);
  c.entries[0].body = saved;
  t('restore re-verifies', c.verify() === true);
  const h = c.entries[1].hash;
  c.entries[1].hash = '0' + h.slice(3);
  t('hash tamper breaks verify', c.verify() === false);
}

// JevCell mean-window + floor
{
  const c = new J.ReceiptChain();
  const cell = new J.JevCell('probe', { window: 4, floor: 0.05, chain: c });
  let alarms = 0;
  for (let i = 0; i < 8; i++) alarms += cell.observe(i, 0.10 + (i === 7 ? 0.2 : 0)) ? 1 : 0;
  t('cell alarms on regime jump', alarms === 1 && cell.alarms.length === 1, JSON.stringify(cell.alarms));
  t('cell booked readings to chain', c.entries.length === 8 && c.verify() === true);
}

// duke seam: runArgument rounds land as receipts, deterministic replay matches
{
  const c1 = new J.ReceiptChain(), c2 = new J.ReceiptChain();
  const r1 = E.runArgument({ seed: 'jev/duketest', artist: 'duke', persona: 'purist', maxRounds: 4 });
  const r2 = E.runArgument({ seed: 'jev/duketest', artist: 'duke', persona: 'purist', maxRounds: 4 });
  J.bookArgument(c1, r1); J.bookArgument(c2, r2);
  t('same seed → identical booked rounds', JSON.stringify(r1.rounds) === JSON.stringify(r2.rounds));
  t('argument chains verify', c1.verify() === true && c2.verify() === true);
  t('chain covers argument+rounds+verdict', c1.entries.length === r1.rounds.length + 2,
    String(c1.entries.length));
  t('booked sigma is the engine number',
    c1.entries.slice(1, 1 + r1.rounds.length).every((e, i) =>
      JSON.parse(e.body).payload.sigma === r1.rounds[i].sigma));
  // tamper the verdict after the fact — witness refuses
  const vb = c1.entries[c1.entries.length - 1].body;
  c1.entries[c1.entries.length - 1].body = vb.replace(/"rounds":\d+/, '"rounds":99');
  t('verdict tamper breaks chain', c1.verify() === false);
}

// honest negative: bookArgument refuses non-run input
{
  let threw = false;
  try { J.bookArgument(new J.ReceiptChain(), { seed: 'x' }); } catch (e) { threw = e instanceof TypeError; }
  t('bookArgument refuses non-run (never invents rounds)', threw === true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
