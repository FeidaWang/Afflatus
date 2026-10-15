import {describe,it,expect} from 'vitest';
import {TetrisScript} from '../src/pages/portfolioTetris.js';
describe('progressive portfolio simulation',()=>{
  it.each([
    {seed:20250701},
    {cols:26,rows:10,seed:2026,ceiling:.8},
    {cols:40,rows:7,seed:2027,ceiling:.9},
  ])('retains the exact initial frame for $seed',options=>{
    const prefix=new TetrisScript({...options,length:32});
    const complete=new TetrisScript({...options,length:80});
    expect(prefix.frame(26)).toEqual(complete.frame(26));
  });
  it('adopts structured-cloned worker data without losing frame methods',()=>{
    const options={cols:26,rows:10,seed:2026,ceiling:.8};
    const prefix=new TetrisScript({...options,length:32});
    const complete=new TetrisScript({...options,length:80});
    Object.assign(prefix,structuredClone(complete));
    expect(prefix.frame(65.5)).toEqual(complete.frame(65.5));
  });
});
