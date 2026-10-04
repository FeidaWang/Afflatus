import React,{useEffect,useRef,useState} from 'react';
import {makeSeries,pointLabel,formatPrice} from './marketData.js';
import {PriceChart} from './PriceChart.jsx';
const wash=new Image();wash.src='/assets/pigment-wash.png';

function OriginalMarketChart({asset,period='1M',compact=false,english=false,unit='USD'}) {
  const canvasRef=useRef(null),frameRef=useRef(null),geometry=useRef(null);
  const [hover,setHover]=useState(null);
  const data=makeSeries(asset,period);
  useEffect(()=> {
    const frame=frameRef.current,canvas=canvasRef.current;
    const draw=()=> {
      const width=frame.clientWidth,height=frame.clientHeight;if(!width||!height)return;
      const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;
      const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
      const pad=compact?{l:4,r:9,t:8,b:4}:{l:50,r:20,t:24,b:36};
      const w=width-pad.l-pad.r,h=height-pad.t-pad.b,series=makeSeries(asset,period);
      let min=Math.min(...series),max=Math.max(...series);
      if(!compact) {
        const raw=(max-min)/3;const power=Math.pow(10,Math.floor(Math.log10(raw||1)));
        const step=([1,2,5,10].find(value=>value*power>=raw)||10)*power;
        min=Math.floor(min/step)*step;max=Math.ceil(max/step)*step;
        if(max===min)max=min+step;
      } else {const range=max-min||1;min-=range*.12;max+=range*.12;}
      const x=i=>pad.l+i/120*w,y=value=>pad.t+(max-value)/(max-min)*h;
      geometry.current={pad,w,x,y,series};
      if(!compact) {
        ctx.lineWidth=.6;ctx.strokeStyle='rgba(130,126,117,.09)';
        for(let i=0;i<=28;i++){const gx=pad.l+i/28*w;ctx.beginPath();ctx.moveTo(gx,pad.t);ctx.lineTo(gx,pad.t+h);ctx.stroke();}
        for(let i=0;i<=12;i++){const gy=pad.t+i/12*h;ctx.beginPath();ctx.moveTo(pad.l,gy);ctx.lineTo(pad.l+w,gy);ctx.stroke();}
        ctx.font='13px Inter, system-ui, sans-serif';ctx.fillStyle='#64655f';ctx.textAlign='right';
        const step=(max-min)/3;
        for(let i=0;i<=3;i++){const value=min+i*step,gy=y(value);ctx.fillText(value>=100?Math.round(value).toLocaleString('en-US'):value.toFixed(1),pad.l-14,gy+4);ctx.strokeStyle='rgba(126,122,114,.18)';ctx.beginPath();ctx.moveTo(pad.l,gy);ctx.lineTo(pad.l+w,gy);ctx.stroke();}
        ctx.textAlign='center';
        [0,30,60,90,120].forEach(i=>ctx.fillText(period==='1D'?pointLabel(i,period).replace(' ET',''):pointLabel(i,period,english),x(i),pad.t+h+26));
      }
      // Data geometry masks a real generated watercolor texture.
      ctx.save();ctx.beginPath();ctx.moveTo(x(0),pad.t+h);series.forEach((v,i)=>ctx.lineTo(x(i),y(v)));ctx.lineTo(x(120),pad.t+h);ctx.closePath();ctx.clip();
      ctx.fillStyle=asset.color;ctx.globalAlpha=compact?.24:.40;ctx.fillRect(pad.l,pad.t,w,h);
      if(wash.complete&&wash.naturalWidth){ctx.globalAlpha=.72;ctx.globalCompositeOperation='multiply';ctx.drawImage(wash,pad.l,pad.t,w,h);}ctx.restore();
      ctx.strokeStyle=compact?asset.color:'#555063';ctx.lineWidth=compact?1.15:1.65;ctx.lineJoin='round';ctx.beginPath();series.forEach((v,i)=>i?ctx.lineTo(x(i),y(v)):ctx.moveTo(x(i),y(v)));ctx.stroke();
      const size=compact?6:14;ctx.globalAlpha=.85;ctx.fillStyle=asset.color;ctx.fillRect(x(120)-size/2,y(series[120])-size/2,size,size);ctx.globalAlpha=1;ctx.lineWidth=1;ctx.strokeStyle=compact?asset.color:'#514a66';ctx.strokeRect(x(120)-size/2,y(series[120])-size/2,size,size);
      if(hover!==null&&!compact){ctx.strokeStyle='#9284b9';ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(x(hover),pad.t);ctx.lineTo(x(hover),pad.t+h);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#7d6fe0';ctx.beginPath();ctx.arc(x(hover),y(series[hover]),4,0,Math.PI*2);ctx.fill();}
    };
    draw();const observer=new ResizeObserver(draw);observer.observe(frame);wash.addEventListener('load',draw);
    return()=>{observer.disconnect();wash.removeEventListener('load',draw);};
  },[asset,period,compact,hover,english]);
  const move=event=>{if(compact||!geometry.current)return;const{pad,w}=geometry.current;const cursor=event.clientX-frameRef.current.getBoundingClientRect().left;setHover(Math.max(0,Math.min(120,Math.round((cursor-pad.l)/w*120))));};
  return <div ref={frameRef} className={compact?'sparkline':'market-chart'} tabIndex={compact?undefined:0} role={compact?undefined:'img'}
    aria-label={compact?undefined:`${asset.name} ${period} ${english?'sample chart. Use arrow keys to inspect':'示例走势图，可用左右方向键查看数据'}`}
    onPointerMove={compact?undefined:move} onPointerLeave={()=>setHover(null)} onFocus={compact?undefined:()=>setHover(120)} onBlur={()=>setHover(null)}
    onKeyDown={event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();setHover(value=>Math.max(0,Math.min(120,(value??120)+(event.key==='ArrowLeft'?-1:1))));}}}>
    <canvas ref={canvasRef} aria-hidden="true"/>
    {hover!==null&&!compact&&<div className="chart-tooltip" style={{left:`${Math.max(5,Math.min(77,7+hover/120*82))}%`}}><span>{pointLabel(hover,period,english)}</span><strong>{formatPrice(data[hover])}</strong><small>{asset.symbol} · {unit}</small></div>}
  </div>;
}

export function MarketChart(props){return props.compact?<OriginalMarketChart {...props}/>:<PriceChart {...props}/>;}
