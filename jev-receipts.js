/* jev-receipts.js — JEV booking layer for the duke-lab instrument.
 * Port 3 of the JEV cross-language plan (JEV-SPEC §6): TS = twist-engine PR #8,
 * Rust = jev-quilt PR #5, WASM-target = this module (duke-lab runs in-browser;
 * plain JS keeps it wasm-pack-free — receipts are the point, not the packaging).
 * Cross-language contract pinned by jev-quilt PR #3:
 *   fnv1a-1a-UTF8("café Δ 日本語") === 0x024a555471370b18d
 * duke-lab's runArgument already averages the 16-feature trace over LISTENS
 * takes; what was missing is the ledger — every round booked, every regime
 * change alarmed. See THE-ECHOGRAM (AI-Writings PR #54).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.JevReceipts = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function fnv1a(str) {
    let h = 0xcbf29ce484222325n;
    for (const b of new TextEncoder().encode(str)) {
      h ^= BigInt(b);
      h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
    }
    return h;
  }

  const hex = (h) => "0x" + h.toString(16).padStart(16, "0");

  class ReceiptChain {
    constructor() { this.entries = []; }
    book(kind, payload) {
      const body = JSON.stringify({ kind, payload });
      const parent = this.entries.length
        ? this.entries[this.entries.length - 1].hash : "0".repeat(64);
      // receipts chain by double-fnv1a over parent+body; FNV-1a stays the
      // content-address (legacy-weak for security, fine for identity).
      let h = parent + body, hv = 0xcbf29ce484222325n;
      for (let r = 0; r < 2; r++) {
        for (const c of h) { hv ^= BigInt(c.codePointAt(0)); hv = (hv * 0x100000001b3n) & 0xffffffffffffffffn; }
        h = hex(hv);
      }
      const e = { hash: h, parent, body };
      this.entries.push(e);
      return e.hash;
    }
    verify() {
      return this.entries.every((e, i) => {
        const want = i ? this.entries[i - 1].hash : "0".repeat(64);
        if (e.parent !== want) return false;
        let h = e.parent + e.body, hv = 0xcbf29ce484222325n;
        for (let r = 0; r < 2; r++) {
          for (const c of h) { hv ^= BigInt(c.codePointAt(0)); hv = (hv * 0x100000001b3n) & 0xffffffffffffffffn; }
          h = hex(hv);
        }
        return e.hash === h;
      });
    }
  }

  class JevCell {
    constructor(name, { window = 8, floor = 0.08, chain } = {}) {
      this.name = name; this.window = window; this.floor = floor;
      this.chain = chain; this.hist = []; this.alarms = [];
    }
    observe(t, value) {
      let alarmed = false;
      if (this.hist.length >= this.window) {
        const w = this.hist.slice(-this.window);
        const pred = w.reduce((a, b) => a + b, 0) / w.length;
        const err = Math.abs(value - pred);
        if (err > this.floor) { alarmed = true; this.alarms.push(t); }
      }
      this.hist.push(value);
      if (this.chain)
        this.chain.book(alarmed ? "jev.alarm" : "jev.reading",
          { cell: this.name, t, value, alarmed });
      return alarmed;
    }
  }

  // duke-lab seam: book one receipt per round of a runArgument result.
  // Payload carries only engine-emitted numbers (round, sigma, arc) — the
  // receipt witnesses the run, it never re-scores it.
  function bookArgument(chain, run) {
    if (!run || !Array.isArray(run.rounds)) throw new TypeError("bookArgument: runArgument result required");
    chain.book("duke.argument", { seed: run.seed, artist: run.artist, persona: run.persona, listens: run.listens });
    for (const r of run.rounds)
      chain.book("duke.round", { round: r.round, sigma: r.sigma, arc: r.arc });
    chain.book("duke.verdict", { verdict: run.verdict, rounds: run.rounds.length });
    return chain;
  }

  return { fnv1a, hex, ReceiptChain, JevCell, bookArgument };
});
