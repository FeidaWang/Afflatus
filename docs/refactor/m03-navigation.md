# AFFLATUS M03 navigation and route compatibility

## Primary model

`src/config/primaryNavigation.js` owns the five primary concepts used by the
cinematic home and every shared inner-page header:

| Primary navigation | Compatibility landing route | Previous grouping |
|---|---|---|
| Systems | `/portfolio.html` | Home / Portfolio |
| Intelligence | `/signal.html` | Markets |
| Field Notes | `/course.html` | Writing |
| Experiments | `/arena.html` | Lab |
| About | `/#about` | About |

`Enter Command` remains the sole header primary CTA. It opens the existing
command-deck implementation; M14 remains responsible for a dedicated Command
route and its product UI.

## Interaction contract

- The current primary category has `aria-current="page"`.
- Mobile navigation opens from a labelled button; Escape closes it and returns
  focus to that button.
- The language control stays on its current route and preserves query/hash
  through `localeSwitchHref`.
- Header states use borders and opacity only—no continuous glow animation.

## Legacy route contract

`LEGACY_ROUTE_COMPATIBILITY` records retained page entries and Vercel-owned
permanent redirects. `tests/m03Navigation.test.js` verifies every item maps to
an active route or matching redirect; `e2e/m03-navigation.spec.js` covers the
rendered desktop, mobile, keyboard, and language flows.
