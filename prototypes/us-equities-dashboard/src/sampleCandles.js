import {makeSeries} from './marketData.js';
import {isNyseSession} from './marketSession.js';
import {stockWindow} from './stockChartUtils.js';

// These are the original prototype's fictional prices, never live market bars.
export function sampleCandles(asset, intraday=false) {
  const dates=[];
  for(let date=new Date('2022-01-03T00:00:00Z');date<=new Date('2026-10-02T00:00:00Z');date.setUTCDate(date.getUTCDate()+1)) {
    const t=date.toISOString().slice(0,10);if(isNyseSession(t))dates.push({t});
  }
  const monthCount=stockWindow(dates,'M').count;
  const month=makeSeries(asset,'1M'),year=makeSeries(asset,'1Y'),day=makeSeries(asset,'1D');
  const interpolate=(series,progress)=>{const position=progress*120,index=Math.floor(position);return series[index]+((series[Math.min(120,index+1)]-series[index])*(position-index));};
  const data=intraday?Array.from({length:78},(_,i)=>({t:`2026-10-02 ${String(Math.floor((570+i*5)/60)).padStart(2,'0')}:${String((570+i*5)%60).padStart(2,'0')}`})):dates;
  return data.map((row,index)=>{
    const priorCount=dates.length-monthCount;
    const c=intraday?interpolate(day,index/77):index>=priorCount?interpolate(month,(index-priorCount)/(monthCount-1)):interpolate(year,index/Math.max(1,priorCount-1))*(month[0]/year.at(-1));
    const o=index?intraday?interpolate(day,(index-1)/77):index>priorCount?interpolate(month,(index-priorCount-1)/(monthCount-1)):interpolate(year,Math.max(0,index-1)/Math.max(1,priorCount-1))*(month[0]/year.at(-1)):c;
    const wick=asset.price*(intraday?.0005:.002)*(1+Math.abs(Math.sin(index+asset.seed)));
    return {t:row.t,o,c,h:Math.max(o,c)+wick,l:Math.min(o,c)-wick,v:0};
  });
}
