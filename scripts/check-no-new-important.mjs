#!/usr/bin/env node
/* check-no-new-important.mjs — U21 Phase 1 D1 discipline
 * (rfcs/2026-07-12-u21-phase1-tech-audit.md §1.3): now that src/styles.css
 * is wrapped in `@layer legacy` and empty `tokens`/`components`/`overrides`
 * layers exist above it in priority, !important is no longer needed for
 * anything written from now on — a layered rule with zero specificity
 * still beats every legacy rule. This is a frozen-baseline guard, not a
 * full CSS parser: it just fails if the total !important count in the
 * checked files grows past what was measured on 2026-07-12 (the day of
 * the @layer migration). `legacy` itself is exempt — it predates this
 * rule and mass-editing 2,958 existing declarations is not the goal.
 *
 * Usage: node scripts/check-no-new-important.mjs
 * A real reduction (cleanup work) simply lowers the number below and the
 * check keeps passing — ratchet, not a fixed target. */
import { readFileSync } from 'node:fs';

const BASELINES = {
  // U28 28b (2026-07-14): +2 for a new `.hero{min-height,padding-bottom}`
  // override that closes the hero->stardrive gap. It has to live (and use
  // !important) inside @layer legacy, not @layer overrides: per the CSS
  // cascade-layers spec, importance reverses layer order, so a later-
  // declared layer's !important (overrides) actually loses to an earlier
  // layer's !important (legacy) — @layer overrides can only beat legacy's
  // *normal* declarations, never its existing !important ones. Fighting an
  // existing legacy !important on the same property has no other option.
  'src/styles.css': 2960,
  'index.html': 2,
};

let anyFail = false;
for (const [path, baseline] of Object.entries(BASELINES)) {
  let content;
  try {
    content = readFileSync(path, 'utf8');
  } catch (e) {
    console.log(`SKIP: ${path} not found`);
    continue;
  }
  const count = (content.match(/!important/g) || []).length;
  if (count > baseline) {
    console.error(`FAIL: ${path} has ${count} "!important" declarations, up from the 2026-07-12 baseline of ${baseline}. New rules should use the @layer overrides layer instead — see src/styles.css's top-of-file comment.`);
    anyFail = true;
  } else {
    console.log(`OK: ${path} — ${count} !important (baseline ${baseline}, ${count < baseline ? 'down' : 'unchanged'})`);
  }
}

process.exit(anyFail ? 1 : 0);
