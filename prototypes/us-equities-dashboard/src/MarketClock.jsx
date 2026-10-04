import React,{useEffect,useState} from 'react';
import {assessNyseSession} from './marketSession.js';

export function MarketClock({english}) {
  const[now,setNow]=useState(()=>new Date());
  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(timer);},[]);
  const session=assessNyseSession(now),target=session.regularOpen?session.closeMs:session.nextOpenMs;
  const remaining=target===null?null:Math.max(0,Math.floor((target-now.getTime())/1000));
  const days=Math.floor(remaining/86400),hours=Math.floor(remaining%86400/3600),minutes=Math.floor(remaining%3600/60),seconds=remaining%60;
  const clock=remaining===null?'—':`${days?`${days}${english?'d':'天'} `:''}${[hours,minutes,seconds].map(n=>String(n).padStart(2,'0')).join(':')}`;
  const local=target===null?(english?'Calendar update required':'等待交易日历更新'):new Intl.DateTimeFormat(english?'en-AU':'zh-CN',{timeZone:'Australia/Melbourne',month:'short',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZoneName:'short'}).format(target);
  return <div className="opening-countdown"><strong>{session.regularOpen?(english?'Market open · Closes in':'美股交易中 · 距收盘'):(english?'Next US market open':'距美股下一次开盘')}</strong><p className="opening-clock" aria-live="off">{clock}</p><span>{english?'Melbourne':'墨尔本'} · {local}</span></div>;
}
