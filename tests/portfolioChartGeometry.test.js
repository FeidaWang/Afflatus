import {describe,it,expect} from 'vitest';
import {chartNumber,chartScale} from '../src/ui/portfolioChartGeometry.js';

describe('Portfolio disclosed-value geometry',()=>{
 it('distinguishes missing, zero and signed reported values',()=>{
  expect(chartNumber('−22%')).toBe(-22);expect(chartNumber('+260.4%')).toBe(260.4);
  expect(chartNumber('0')).toBe(0);
  for(const value of ['',null,'—','无数据','No data','NaN','18abc']) expect(chartNumber(value)).toBeNull();
 });
 it('uses a common zero origin with accurate marks for the five cycles',()=>{
  const s=chartScale([260.4,208.5,257.9,32.6,85.6]);expect(s.min).toBe(-0);expect(s.max).toBe(300);
  expect(s.mark(260.4).width).toBeCloseTo(86.8);expect(s.mark(0).width).toBe(0);
  const days=chartScale([17.5,3,11.2,246,5.6]);expect(days.max).toBe(250);expect(days.mark(3).point).toBeCloseTo(1.2);
 });
 it('retains a missing mark without turning it into zero',()=>{
  const s=chartScale([null,0,12]);expect(s.mark(null)).toBeNull();expect(s.mark(NaN)).toBeNull();expect(s.mark(0).width).toBe(0);
 });
 it('draws negative values to the left of zero and keeps single/extreme series finite',()=>{
  for(const values of [[0],[null],[-22],[8],[-500,1000],[1e-7,1e9]]){
   const s=chartScale(values);expect(Number.isFinite(s.zero)).toBe(true);expect(s.min).toBeLessThanOrEqual(0);expect(s.max).toBeGreaterThanOrEqual(0);
   values.filter(Number.isFinite).forEach(value=>{const m=s.mark(value);expect(m.width).toBeGreaterThanOrEqual(0);expect(m.point).toBeGreaterThanOrEqual(0);expect(m.point).toBeLessThanOrEqual(100);if(value<0)expect(m.start+m.width).toBeCloseTo(s.zero);});
  }
 });
});
