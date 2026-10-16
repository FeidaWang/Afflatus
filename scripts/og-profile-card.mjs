// Personal sharing card, matching the homepage hero: headline, skills and the film poster.
export function profileCardHtml({locale,sansFont,serifFont,poster}) {
  const zh=locale==='zh';
  const chips=zh?['编程智能体','智能体与上下文工程','评测与测试','AI 产品设计','AI 产业研究']:['Agentic Coding','Agent &amp; Context Engineering','Evals &amp; Testing','AI Product Design','AI Industry Research'];
  return `<!doctype html><html lang="${zh?'zh-CN':'en-GB'}"><head><meta charset="utf-8"><style>
  @font-face{font-family:Profile;src:url("${sansFont}") format("woff2");font-weight:300 800}
  @font-face{font-family:ProfileSerif;src:url("${serifFont}") format("woff2");font-weight:200 800}
  *{box-sizing:border-box;margin:0}html,body{width:1200px;height:630px;overflow:hidden}
  body{background:#f0eee6;color:#111110;font-family:Profile,'PingFang SC',sans-serif;-webkit-font-smoothing:antialiased}
  .top{position:absolute;left:56px;top:46px;font-size:15px;font-weight:600;letter-spacing:.16em}.top span{color:#5c5b55;font-weight:500}
  h1{position:absolute;left:52px;top:104px;width:560px;font-size:${zh?'64':'70'}px;line-height:${zh?'1.12':'.98'};font-weight:700;letter-spacing:${zh?'-.03em':'-.055em'}}
  .lede{position:absolute;left:56px;top:362px;width:560px;font-family:${zh?"'Songti SC'":'ProfileSerif'},serif;font-size:25px;line-height:1.28;letter-spacing:-.02em;color:#2a2a27}
  .chips{position:absolute;left:56px;top:448px;width:540px;display:flex;flex-wrap:wrap;gap:8px}
  .chips b{font-weight:500;font-size:14.5px;padding:6px 12px;border:1px solid #ceccc3;border-radius:999px;color:#2f2f2b;background:#f7f5ef}
  .film{position:absolute;left:640px;top:46px;width:504px;height:470px;border-radius:12px;overflow:hidden;box-shadow:0 14px 40px #2a26180f;background:#000}
  .film img{width:100%;height:100%;object-fit:cover;object-position:17% 50%}
  .foot{position:absolute;left:56px;right:56px;bottom:30px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #ceccc3;padding-top:12px;font-size:14px;color:#5c5b55;letter-spacing:.04em}
  .foot .d{color:#111110;font-weight:700;font-size:17px;letter-spacing:0}
  </style></head><body>
  <div class="top">${zh?'王飞达 FEIDA WANG':'FEIDA WANG'} <span>· AFFLATUS</span></div>
  <h1>${zh?'从这颗星球，<br>驶向更远的<br>地方。':'From this world, into what comes next.'}</h1>
  <p class="lede">${zh?'编程智能体、AI 产品与研究——设计、构建，并作为真实运行的软件上线。':'Agentic coding, AI products and research — designed, built and shipped as working software.'}</p>
  <div class="chips">${chips.map(c=>`<b>${c}</b>`).join('')}</div>
  <div class="film"><img src="${poster}" alt=""></div>
  <div class="foot"><span>${zh?'AI 工程 · 产品设计 · 研究':'AI ENGINEERING · PRODUCT DESIGN · RESEARCH'}</span><span class="d">feida.au</span></div>
  </body></html>`;
}
