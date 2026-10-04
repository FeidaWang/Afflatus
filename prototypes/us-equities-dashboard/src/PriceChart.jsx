import React,{useEffect,useMemo,useRef,useState} from 'react';
import {sampleCandles} from './sampleCandles.js';
import {stockWindow,aggregateCandles} from './stockChartUtils.js';
import {formatPrice} from './marketData.js';

const wash=new Image();wash.src='/assets/pigment-wash.png';
export function PriceChart({asset,period='M',chartStyle='candles',english=false,unit='USD'}) {
  const frameRef=useRef(null),canvasRef=useRef(null),geometry=useRef(null),drag=useRef(null);
  const[position,setPosition]=useState(1),[hover,setHover]=useState(null),[zoom,setZoom]=useState(null);
  const history=useMemo(()=>sampleCandles(asset,period==='D'),[asset,period]);
  const view=stockWindow(history,period,position);
  if(zoom!==null){view.count=Math.min(history.length,Math.max(5,zoom));view.maxStart=history.length-view.count;view.start=Math.round(position*view.maxStart);view.candles=history.slice(view.start,view.start+view.count);}
  const active=geometry.current?.bars?.[hover];
  useEffect(()=>{
    const frame=frameRef.current,canvas=canvasRef.current;
    const draw=()=>{
      const width=frame.clientWidth,height=frame.clientHeight;if(!width||!height)return;
      const dpr=Math.min(devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;
      const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
      const pad={l:50,r:20,t:24,b:36},w=width-pad.l-pad.r,h=height-pad.t-pad.b;
      const {candles:bars}=aggregateCandles(view.candles,Math.max(25,Math.floor(w/8)));
      let min=Math.min(...bars.map(c=>c.l)),max=Math.max(...bars.map(c=>c.h));
      const raw=(max-min)/3,power=10**Math.floor(Math.log10(raw||1)),step=([1,2,5,10].find(n=>n*power>=raw)||10)*power;
      min=Math.floor(min/step)*step;max=Math.ceil(max/step)*step;if(max===min)max=min+step;
      const x=i=>pad.l+(i+.5)/bars.length*w,y=value=>pad.t+(max-value)/(max-min)*h;
      geometry.current={bars,pad,w,x,y};
      ctx.lineWidth=.6;ctx.strokeStyle='rgba(130,126,117,.09)';
      for(let i=0;i<=28;i++){const gx=pad.l+i/28*w;ctx.beginPath();ctx.moveTo(gx,pad.t);ctx.lineTo(gx,pad.t+h);ctx.stroke();}
      for(let i=0;i<=12;i++){const gy=pad.t+i/12*h;ctx.beginPath();ctx.moveTo(pad.l,gy);ctx.lineTo(pad.l+w,gy);ctx.stroke();}
      ctx.font='13px Inter,system-ui,sans-serif';ctx.fillStyle='#64655f';ctx.textAlign='right';
      for(let i=0;i<=3;i++){const price=min+i*(max-min)/3;ctx.fillText(price>=100?Math.round(price).toLocaleString('en-US'):price.toFixed(1),pad.l-14,y(price)+4);ctx.strokeStyle='rgba(126,122,114,.18)';ctx.beginPath();ctx.moveTo(pad.l,y(price));ctx.lineTo(pad.l+w,y(price));ctx.stroke();}
      ctx.textAlign='center';const indices=[...new Set([0,Math.floor((bars.length-1)/4),Math.floor((bars.length-1)/2),Math.floor((bars.length-1)*3/4),bars.length-1])];
      const label=c=>period==='D'?c.t.slice(11,16):new Intl.DateTimeFormat(english?'en-US':'zh-CN',{month:'short',day:'numeric',...(period==='MAX'?{year:'2-digit'}:{}),timeZone:'UTC'}).format(new Date(c.t.slice(0,10)+'T00:00:00Z'));
      indices.forEach(i=>ctx.fillText(label(bars[i]),x(i),pad.t+h+26));
      // Wax-pencil strokes retain the original generated pigment texture and grid.
      const brush=document.createElement('canvas');brush.width=canvas.width;brush.height=canvas.height;
      const ink=brush.getContext('2d');ink.scale(dpr,dpr);ink.lineCap='round';ink.lineJoin='round';
      const green='#568061',red='#bf6761';
      if(chartStyle==='candles'){
        const bw=Math.max(2,Math.min(15,w/bars.length*.6));
        bars.forEach((c,i)=>{ink.strokeStyle=c.c>=c.o?green:red;ink.fillStyle=ink.strokeStyle;ink.lineWidth=1.4;ink.beginPath();ink.moveTo(x(i),y(c.h));ink.lineTo(x(i),y(c.l));ink.stroke();const top=y(Math.max(c.o,c.c)),bh=Math.max(1.8,Math.abs(y(c.o)-y(c.c)));ink.globalAlpha=.73;ink.fillRect(x(i)-bw/2,top,bw,bh);ink.globalAlpha=1;ink.strokeRect(x(i)-bw/2,top,bw,bh);});
      }else{
        // Keep the selected design's quiet pigment area beneath a precise price line.
        ctx.save();ctx.beginPath();ctx.moveTo(x(0),pad.t+h);bars.forEach((c,i)=>ctx.lineTo(x(i),y(c.c)));ctx.lineTo(x(bars.length-1),pad.t+h);ctx.closePath();ctx.clip();ctx.fillStyle=asset.color;ctx.globalAlpha=.24;ctx.fillRect(pad.l,pad.t,w,h);if(wash.complete&&wash.naturalWidth){ctx.globalAlpha=.55;ctx.globalCompositeOperation='multiply';ctx.drawImage(wash,pad.l,pad.t,w,h);}ctx.restore();
        ink.lineWidth=2.3;bars.slice(1).forEach((c,i)=>{ink.strokeStyle=c.c>=bars[i].c?green:red;ink.beginPath();ink.moveTo(x(i),y(bars[i].c));ink.lineTo(x(i+1),y(c.c));ink.stroke();});
      }
      // Fine dry-grain holes stay inside the true plotted geometry.
      ink.globalCompositeOperation='destination-out';ink.fillStyle='#000';for(let i=0;i<w*h/7;i++){const gx=pad.l+(i*17.371%w),gy=pad.t+(i*29.137%h);ink.globalAlpha=.12+(i%5)*.06;ink.fillRect(gx,gy,.65,.7);}ink.globalAlpha=1;ctx.drawImage(brush,0,0,width,height);
      if(hover!==null&&bars[hover]){ctx.strokeStyle='#9284b9';ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(x(hover),pad.t);ctx.lineTo(x(hover),pad.t+h);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#7d6fe0';ctx.beginPath();ctx.arc(x(hover),y(bars[hover].c),3,0,Math.PI*2);ctx.fill();}
    };
    draw();const observer=new ResizeObserver(draw);observer.observe(frame);wash.addEventListener('load',draw);return()=>{observer.disconnect();wash.removeEventListener('load',draw);};
  },[asset,period,chartStyle,english,position,hover,zoom]);
  const move=event=>{const g=geometry.current;if(!g)return;const rect=frameRef.current.getBoundingClientRect();if(drag.current&&view.maxStart){setPosition(Math.max(0,Math.min(1,drag.current.position-(event.clientX-drag.current.x)/g.w*view.count/view.maxStart)));setHover(null);}else setHover(Math.max(0,Math.min(g.bars.length-1,Math.floor((event.clientX-rect.left-g.pad.l)/g.w*g.bars.length))));};
  return <>
    <div ref={frameRef} className="market-chart" role="img" tabIndex={0} aria-label={`${asset.name} ${period} ${english?'fictional sample chart. Use arrow keys to inspect.':'示例图表，方向键查看行情。'}`} onPointerDown={event=>{if(event.button!==0)return;drag.current={x:event.clientX,position};event.currentTarget.setPointerCapture(event.pointerId);}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onPointerMove={move} onPointerLeave={()=>{if(!drag.current)setHover(null);}} onFocus={()=>setHover(geometry.current?.bars.length-1)} onBlur={()=>setHover(null)} onKeyDown={event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();setHover(value=>Math.max(0,Math.min(geometry.current.bars.length-1,(value??geometry.current.bars.length-1)+(event.key==='ArrowLeft'?-1:1))));}}}>
      <canvas ref={canvasRef} aria-hidden="true"/>
      {active&&<div className="chart-tooltip" style={{left:`${Math.max(5,Math.min(65,7+hover/Math.max(1,geometry.current.bars.length-1)*82))}%`}}><span>{active.t}{active.end!==active.t?` — ${active.end}`:''}</span><strong>{formatPrice(active.c)}</strong><small>{asset.symbol} · {unit}</small><small>{english?'O':'开'} {formatPrice(active.o)} · {english?'H':'高'} {formatPrice(active.h)}<br/>{english?'L':'低'} {formatPrice(active.l)} · {english?'C':'收'} {formatPrice(active.c)}</small></div>}
    </div>
    <div className="price-navigation"><span>{view.candles[0]?.t.slice(0,period==='D'?16:10)}</span><input type="range" min={0} max={1000} value={Math.round(position*1000)} disabled={!view.maxStart} aria-label={english?'Drag to browse chart dates':'左右拖动查看历史日期'} aria-valuetext={`${view.candles[0]?.t} — ${view.candles.at(-1)?.t}`} onChange={event=>{setPosition(Number(event.target.value)/1000);setHover(null);}}/><span>{view.candles.at(-1)?.t.slice(0,period==='D'?16:10)}</span><button aria-label={english?'Zoom in':'放大'} disabled={view.count<=5} onClick={()=>{setZoom(Math.max(5,Math.round(view.count*.65)));setHover(null);}}>＋</button><button aria-label={english?'Zoom out':'缩小'} disabled={view.count===history.length} onClick={()=>{setZoom(Math.min(history.length,Math.round(view.count*1.5)));setHover(null);}}>−</button></div>
  </>;
}
