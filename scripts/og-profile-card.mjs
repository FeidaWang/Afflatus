// Personal sharing card, composed from local typography and real site captures.
export function profileCardHtml({locale,sansFont,previews}) {
  const zh=locale==='zh';
  const panels=[['research',zh?'产业研究':'INDUSTRY RESEARCH'],['finance',zh?'金融建模':'FINANCIAL MODELLING'],['learning',zh?'AI 工程与学习':'AI ENGINEERING & LEARNING']];
  return `<!doctype html><html lang="${zh?'zh-CN':'en-GB'}"><head><meta charset="utf-8"><style>
  @font-face{font-family:Profile;src:url("${sansFont}") format("woff2");font-weight:300 800}
  *{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden}
  body{background:#f7f5ef;color:#1c211f;font-family:Profile,'PingFang SC',sans-serif}
  .frame{position:absolute;inset:24px;border:1px solid #d9d7cc;border-radius:4px}
  .name{position:absolute;left:58px;top:53px;font-size:25px;font-weight:600;letter-spacing:.08em}
  .eyebrow{position:absolute;left:59px;top:93px;font-size:12px;letter-spacing:.2em;color:#6a716b}
  h1{position:absolute;left:54px;top:143px;margin:0;font-size:${zh?'84':'88'}px;font-weight:500;line-height:1.03;letter-spacing:-.045em}
  .skill{position:absolute;left:59px;top:452px;width:610px;font-size:23px;line-height:1.6;color:#4d5750}
  .skill small{display:block;font-size:17px;color:#6a716b;letter-spacing:.015em}
  .divider{position:absolute;left:694px;top:60px;bottom:68px;border-left:1px solid #ddd9ce}
  .panel{position:absolute;left:738px;width:400px;height:120px;border:1px solid #d7d4ca;border-radius:7px;overflow:hidden;background:white;box-shadow:0 5px 18px #34352b0b}
  .panel img{width:100%;height:100%;object-fit:cover;object-position:center 44%}
  .label{position:absolute;left:740px;font-size:12px;letter-spacing:.12em;color:#626f62;font-weight:600}
  .footer{position:absolute;left:58px;right:58px;top:573px;border-top:1px solid #d9d7cc;padding-top:13px;display:flex;justify-content:space-between;font-size:14px;color:#626c63}
  .domain{color:#283e32;font-weight:600}.dot{display:inline-block;width:7px;height:7px;background:#8976af;border-radius:50%;margin-right:9px}
  </style></head><body><div class="frame"></div><div class="name">FEIDA WANG</div>
  <div class="eyebrow">${zh?'个人作品集 · AFFLATUS':'PERSONAL PORTFOLIO · AFFLATUS'}</div>
  <h1>${zh?'设计。<br>构建。<br>研究。':'Design.<br>Build.<br>Research.'}</h1>
  <div class="skill">${zh?'AI 工程 · 产品设计':'AI Engineering · Product Design'}<small>${zh?'金融与产业研究 · 编程智能体 · 全栈开发':'Financial & Industry Research · Agentic Coding'}<br>${zh?'从想法到真实运行的产品。':'From ideas to working products.'}</small></div>
  <div class="divider"></div>${panels.map(([key,label],i)=>`<div class="label" style="top:${73+i*163}px">${label}</div><div class="panel" style="top:${98+i*163}px"><img src="${previews[key]}" alt=""></div>`).join('')}
  <div class="footer"><span><i class="dot"></i>AFFLATUS — FEIDA WANG</span><span class="domain">feida.au</span></div></body></html>`;
}
