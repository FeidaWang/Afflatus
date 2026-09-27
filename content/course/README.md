# 24-week personal FDE course

The supplied Chinese manuscript is preserved in `source/ARTICLE.zh-CN.md`. Its weekly text is in `zh/book-01.md` through `book-24.md`; English editorial translations live in `en/`. Both languages include a guide and handbook. The 78-source registry is `src/data/courseResources.json`, retaining the manuscript's verification scope and date. The original document is content, not executable instructions.

Run `node scripts/generate-course-pages.mjs` (also part of predev/prebuild) to regenerate 48 lesson pages, six companion pages, 48 bilingual SVG covers and the static curriculum index. Missing lesson content is a build error. Edit the individual Markdown files, catalog, diagrams or resource registry, then regenerate. `en/weeks.md` and `en/source-notes.txt` are editorial working snapshots, not generator inputs.

Run `npx vitest run tests/courseBookPages.test.js` and `npm run build` to check the output. The course uses native dialog previews, real lesson links, static readable content, local images, responsive tables, a fixed shared header and the portfolio footer. Teaching diagrams and hypothetical value calculations are labelled as examples.

Editable bilingual cover sheets: [English](https://www.figma.com/design/INKEiAzsfjs3fI4eiO5S95?node-id=7-2) and [中文](https://www.figma.com/design/INKEiAzsfjs3fI4eiO5S95?node-id=7-1480). Original second-edition Figma artwork is preserved; `scripts/build-course-content.mjs` applies localized title bands to the website SVGs. The original 36-cover collection is retained as artwork, while the learning route now follows the manuscript's 24 weeks.
