# AFFLATUS M02 design foundation

## Scope

M02 introduces a shared visual contract without changing navigation, route
ownership, page DOM structure, or WebGL behaviour. It is loaded by both home
experience shells:

- cinematic/static/reduced home: `index.html`;
- legacy rollback home: `portfolio.html`.

The foundation intentionally does not replace the specialised themes of Arena,
Serial, Cityview, and other route pages. M03/M15 own that migration decision.

## Canonical tokens

`public/styles/afflatus-foundation.css` is the literal source of truth:

| Role | Token |
|---|---|
| Void | `--af-void` |
| Hull | `--af-hull` |
| Command | `--af-command` |
| Ion | `--af-ion` |
| Sans / Serif / Mono / Signature | `--af-font-sans`, `--af-font-serif`, `--af-font-mono`, `--af-font-signature` |
| Shell / reading / gutter / section spacing | `--shell-max`, `--reading-max`, `--gutter`, `--section-y` |
| Focus / duration / z-index map | `--af-focus-*`, `--af-duration-*`, `--af-z-*` |

The standard `:focus-visible` ring is an immediate `3px` outline with a `3px`
offset. It does not require a transition or hover state.

## Temporary aliases and M17 cleanup

`body.showcase-page` maps the current showcase names (`--void`, `--carbon`,
`--paper`, `--text`, `--cyan`, `--line`, `--shell`, and `--page`) onto the M02
tokens. `src/styles.css` maps its post-U21 navigation aliases to the same
foundation values.

M17 should remove these aliases after all home components use the canonical
names. It must not globally alias overloaded names such as `--bg`, `--ink`,
or `--mono`: those remain route-local until the route migration has an explicit
design decision.
