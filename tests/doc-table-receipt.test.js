#!/usr/bin/env node
// tests/doc-table-receipt.test.js — the residue doc's table is a RECEIPT, not prose.
// Run: node tests/doc-table-receipt.test.js          (fast pins, always on)
//      DOC_RECEIPT_LIVE=1 node tests/doc-table-receipt.test.js   (+ numeric re-derivation)
//
// docs/SIGMA_RESIDUE_DECOMPOSITION.md was produced by
// qa/residue-decomposition.js (markdown printed to stdout, hand-copied).
// Two pins make that lineage verifiable instead of asserted:
//
//  1. GENERATOR IDENTITY (always): the doc names the script's sha256.
//     A script edit without regenerating the doc trips RED, naming the
//     declared re-embed: rerun the generator, refresh the table AND the
//     digest line, in one commit.
//  2. NUMERIC RE-DERIVATION (DOC_RECEIPT_LIVE=1): reruns the script's
//     --quick rows and asserts each published σ in the doc within 5e-4.
//     Skips honestly without the env var (bounded CI time is a feature,
//     not an evasion — the skip is printed, never silent).

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOC = join(ROOT, "docs/SIGMA_RESIDUE_DECOMPOSITION.md");
const SCRIPT = join(ROOT, "qa/residue-decomposition.js");

let n = 0, bad = 0, skipped = 0;
const check = (name, cond, detail = "") => {
  n++;
  if (!cond) { bad++; console.log(`not ok — ${name}${detail ? " — " + detail : ""}`); }
  else console.log(`ok — ${name}`);
};
const skip = (name, why) => { n++; skipped++; console.log(`ok — ${name} # SKIP ${why}`); };

const doc = readFileSync(DOC, "utf8");
const liveDigest = createHash("sha256").update(readFileSync(SCRIPT)).digest("hex");

// pin 1: generator identity
const m = doc.match(/generator sha256\s*\n?`?([0-9a-f]{64})`?/);
check("doc names the generator script's sha256", !!m,
  'expected a "generator sha256 `<digest>`" line in the doc');
if (m) {
  check("generator digest matches the live script", m[1] === liveDigest,
    `doc pins ${m[1].slice(0, 12)}…, script is ${liveDigest.slice(0, 12)}… — ` +
    "rerun the generator, refresh the table AND the digest line, in one commit");
}

// pin 2: numeric re-derivation (env-gated)
if (process.env.DOC_RECEIPT_LIVE === "1") {
  const out = execFileSync(process.execPath, [SCRIPT, "--quick"], { cwd: ROOT }).toString();
  const rows = [...out.matchAll(/(\w+)\/(\w+): audited σ=([\d.]+)/g)];
  check("live run produced quick rows", rows.length === 4, `got ${rows.length}`);
  for (const [, a, p, sigma] of rows) {
    const docRow = doc.match(new RegExp(`\\|\\s*${a}\\s*\\|\\s*${p}\\s*\\|\\s*([\\d.]+)\\|`));
    check(`doc σ(${a}/${p}) matches live re-derivation`,
      !!docRow && Math.abs(parseFloat(docRow[1]) - parseFloat(sigma)) < 0.0005,
      docRow ? `doc ${docRow[1]} vs live ${sigma}` : "row absent from doc");
  }
} else {
  skip("numeric re-derivation of published σ values", "set DOC_RECEIPT_LIVE=1 to run the ~40s live check");
}

console.log(`\ndoc-table receipt: ${n - bad - skipped} green, ${skipped} honest skip, ${bad} red`);
process.exit(bad ? 1 : 0);
