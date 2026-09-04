/**
 * Existing serious axe findings that need visual-token work rather than
 * structural markup fixes. The exact target list is deliberate: a new target
 * changes this object comparison and fails CI. Remove entries as contrast work
 * lands; never broaden one to a whole rule/site exception.
 */
export const A11Y_BASELINE = Object.freeze({
  main: [
    {
      id: 'color-contrast',
      impact: 'serious',
      help: 'Elements must meet minimum color contrast ratio thresholds',
      targets: ['#f1', '#f2', '#f3', '#footnoteEl', '#s2num', '#s3num'],
    },
  ],
  sectors: [
    {
      id: 'color-contrast',
      impact: 'serious',
      help: 'Elements must meet minimum color contrast ratio thresholds',
      targets: [
        '#card-ASML > .rBody > .rWeight > label > span[data-en="conviction vector"][data-zh="信念权重"]',
        '#card-AVGO > .rBody > .rWeight > label > span[data-en="conviction vector"][data-zh="信念权重"]',
        '#card-MU > .rBody > .rWeight > label > span[data-en="conviction vector"][data-zh="信念权重"]',
        '#card-NVDA > .rBody > .rWeight > label > span[data-en="conviction vector"][data-zh="信念权重"]',
        '#card-SKHY > .rBody > .rWeight > label > span[data-en="conviction vector"][data-zh="信念权重"]',
        '#card-TSM > .rBody > .rWeight > label > span[data-en="conviction vector"][data-zh="信念权重"]',
        '#tickerTrack > .tickerChip[data-ticker="CHTR"] > b',
        '#tickerTrack > .tickerChip[data-ticker="CMCSA"] > b',
        '#tickerTrack > .tickerChip[data-ticker="DIS"] > b',
        '#tickerTrack > .tickerChip[data-ticker="EA"] > b',
        '#tickerTrack > .tickerChip[data-ticker="FOX"] > b',
        '#tickerTrack > .tickerChip[data-ticker="FOXA"] > b',
        '#vendorCard-alibaba > .nBody > .nHead > .nMeta',
        '#vendorCard-anthropic > .nBody > .nHead > .nMeta',
        '#vendorCard-openai > .nBody > .nHead > .nMeta',
        '#vendorCard-zhipu > .nBody > .nHead > .nMeta',
      ],
    },
  ],
  signal: [
    {
      id: 'color-contrast',
      impact: 'serious',
      help: 'Elements must meet minimum color contrast ratio thresholds',
      targets: [
        '#eventDirective',
        '#hdAsOf',
        '#hdMethod',
        '.bias',
        '.stamp',
        '.tag',
        '.tone-amber > h3 > .pid',
        'article[data-id="2"] > h3 > .pid',
        'article[data-id="3"] > h3 > .pid',
        'article[data-id="4"] > h3 > .pid',
        'article[data-id="5"] > h3 > .pid',
        'button[data-term="keter"]',
        'span[data-en="DOVE −2"]',
        'span[data-en="HAWK +2"]',
        'span[data-en="ITEM #: <b>FED-26</b>"] > b',
        'span[data-en="NEUTRAL 0"]',
      ],
    },
  ],
});
