// Bake the same seeded hand-ruled grid into reusable high-density tiles.
// Runtime canvas animation should not repaint the stationary paper texture.
import sharp from 'sharp';
import {drawInkGrid} from '../src/pages/portfolioInk.js';
for(const step of [16,20]) {
  let points=[],fillStyle='';
  const paths=[];
  const context={
    set fillStyle(value){fillStyle=value},
    beginPath(){points=[]},
    moveTo(x,y){points.push([x,y])},
    lineTo(x,y){points.push([x,y])},
    closePath(){},
    fill(){paths.push(`<path fill="${fillStyle}" d="M${points.map(p=>p.map(n=>n.toFixed(3)).join(' ')).join('L')}Z"/>`)},
  };
  await drawInkGrid(context,320,320,{step,major:4,seed:7,strength:.8});
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><rect width="320" height="320" fill="#faf9f5"/>${paths.join('')}</svg>`;
  const result=await sharp(Buffer.from(svg),{density:144}).webp({lossless:true}).toFile(`public/assets/portfolio/grid-${step}.webp`);
  console.log(`Grid ${step}: ${result.width}×${result.height}, ${result.size} bytes`);
}
