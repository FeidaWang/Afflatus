/**
 * Home page (index.html) shared-lib load order, as a single ES module entry.
 *
 * ROADMAP §0b A1: these used to be 3 separate `<script src=... defer>` tags.
 * Converting each to its own independent `<script type="module" src="...">`
 * tag (tried first) turned out to be unreliable under Vite 8's multi-entry
 * HTML chunking - some pages silently shipped without nav.js's code because
 * Rollup's automatic chunk-merging across many same-page `<script type=
 * module>` tags doesn't reliably preserve every module when the same file is
 * an "entry" from several different HTML documents at once (verified via
 * dist output inspection: several pages' bundles were missing entire files).
 * A single entry file with explicit `import` statements sidesteps that
 * entirely - static imports have spec-guaranteed execution order, and
 * Rollup's shared-chunk extraction across *imported* modules (rather than
 * raw script-tag entries) is the same reliable mechanism already used
 * everywhere else in this codebase (e.g. utils/math.js).
 *
 * Order matches the original <script> tag order exactly: audio -> nav -> transition.
 */
import '../lib/audio.js';
import '../lib/nav.js';
import '../lib/transition.js';
