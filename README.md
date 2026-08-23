# AFFLATUS

AFFLATUS is a bilingual, static-first personal command system for capital records, software fieldwork, intelligence dossiers and bounded experiments. The public information architecture is defined in `src/config/siteManifest.js`; the homepage adds a capability-gated cinematic layer without making content, navigation or status dependent on WebGL.

## Local development

```bash
npm install
npm run dev
npm run build
npm test
npm run test:e2e:smoke
```

The production preview is `npm run preview -- --port 4173`. Generated English and Chinese documents live under `dist/en/` and `dist/zh/` after a build.

## Release gates

```bash
npm run typecheck
npm run build
npm test
npm run test:e2e
npm run test:lighthouse
npm run linkcheck
```

The release contract is zero unexplained console errors, no horizontal overflow or clipped/wrapped control labels at supported viewports, complete keyboard navigation, no continuous WebGL for Reduced Motion or Save-Data, and Core Web Vitals budgets of LCP ≤ 2.5s, INP ≤ 200ms and CLS ≤ 0.1.

## Architecture and policy

- [Architecture](docs/refactor/architecture.md)
- [Content map](docs/refactor/content-map.md)
- [Motion policy](docs/refactor/motion-policy.md)
- [M16 cross-device and accessibility report](docs/refactor/m16-cross-device-accessibility.md)
- [M17 release-candidate report](docs/refactor/m17-release-candidate.md)

Legacy route redirects and the retained `/portfolio.html` shell are compatibility surfaces, not parallel sources of truth. See the M17 report before removing either.
