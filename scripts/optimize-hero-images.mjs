// Generate responsive encodings without changing the original artwork.
import sharp from 'sharp';
for (const width of [480, 960]) {
  await sharp('public/assets/labs/reading-landscape.webp').resize({width,withoutEnlargement:true})
    .webp({quality:75,effort:6}).toFile(`public/assets/labs/reading-landscape-${width}.webp`);
  await sharp('public/assets/labs/reading-landscape.webp').resize({width,withoutEnlargement:true})
    .avif({quality:65,effort:6}).toFile(`public/assets/labs/reading-landscape-${width}.avif`);
}
await sharp('public/assets/paper-grid.jpg').avif({quality:85,effort:6}).toFile('public/assets/paper-grid.avif');
for(const width of [480,800]) {
  await sharp('public/assets/signal/policy-ai-hero.jpg').resize({width,withoutEnlargement:true})
    .avif({quality:75,effort:6}).toFile(`public/assets/signal/policy-ai-hero-${width}.avif`);
}
