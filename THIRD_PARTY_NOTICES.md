# Third-party notices

## Company logos

Files under `public/assets/sectors/logos/` are trademarks of their respective
companies. They are used on the sectors page only to identify each company and
imply no affiliation or endorsement. Each file's source page, source URL,
retrieval date and SHA-256 are recorded in
`public/assets/sectors/logos/manifest.json`.

The October 2026 observatory adds Xiaomi and StepFun official SVG marks.
Their original URLs and SHA-256 digests are recorded in the `makers` registry
of `public/data/sectors-observatory/2026-10-09.json`. These trademarks are used
for identification; representative chart colors are editorial choices.

## Fonts on the sectors page (SIL Open Font License 1.1)

`public/assets/fonts/newsreader-var.woff2`, `hanken-grotesk-var.woff2` and
`noto-serif-sc-subset.woff2` are subsets converted to WOFF2 from the
google/fonts repository (`ofl/newsreader`, `ofl/hankengrotesk`,
`ofl/notoserifsc`; the Noto Serif SC subset is a static weight-600 instance).

- Newsreader — Copyright 2020 The Newsreader Project Authors (http://github.com/productiontype/Newsreader)
- Hanken Grotesk — Copyright 2021 The Hanken Grotesk Project Authors (https://github.com/marcologous/hanken-grotesk)
- Noto Serif SC — Copyright 2012 Google Inc. All Rights Reserved.

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded, 
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.

## astronomy-engine (MIT License)

The horoscope page bundles `astronomy-engine` 2.1.19 (planet positions for
Mercury, Venus and Mars, in the page chunk `vendor-astronomy-*.js` and the
horoscope Worker) from https://github.com/cosinekitty/astronomy. Each built
chunk that contains it carries a short notice pointing here.

```
MIT License

Copyright (c) 2019-2023 Don Cross <cosinekitty@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Vibe-Trading research integration

Private daily data adapters, technical indicators, retrospective pattern helpers and P2 research tools use HKUDS/Vibe-Trading at commit 251b094320c1f97d1486626d3618113526914d4c. The English sentiment lexicon and tokenizer in src/features/vibe-markets/sentiment.js are derived from agent/src/tools/sentiment_tool.py, Copyright (c) 2026 Vibe-Trading Contributors, MIT License. Upstream MIT license and root NOTICE: integrations/vibe-us-crypto-kit/licenses/. No upstream font files are included. Original source remains an ignored, pinned local reference; code permission does not establish market-data redistribution permission. The Bitcoin Fear & Greed Index is attributed to Alternative.me beside its displayed data.

## Lightweight component rendering

The frontend resolves React-compatible component imports through Preact 11.0.1
(`preact/compat`); the original React packages remain for package peer contracts.
Preact is MIT licensed: https://github.com/preactjs/preact/blob/main/LICENSE.
Build-time HTML rendering uses `preact-render-to-string`, also MIT licensed.

`public/assets/fonts/labs-serif-ui.woff2` is a further subset of the existing
OFL Noto Serif SC reading font. The original font and license remain available
for complete novel text. Reproduction: `scripts/subset-labs-font.py` with
fontTools 4.67.0 and its WOFF dependencies. No new font or paid service is used.
