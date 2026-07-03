/* 2026-07-04 后内存时代换仓（v1.5 V13）：深度回调后的杠铃配置。
   核心仓（MU/AVGO/NVDA，47%）= 现金流与定价权在回调中未受损的质量资产；
   卫星仓 = 内存墙三主线（HBM/CXL/NAND 分层）纯标的，涨幅透支的压到轻仓。
   三大催化剂（当日检索核实）：韩股半导体巨震＋SK 海力士放缓 HBM 扩产、
   6 月非农 +5.7 万远逊预期、Meta 宣布出租过剩 AI 算力（neocloud 重挫）。
   撤出：TSM/AMD/ASML/LITE/NOK（非存储主线）、FLKR（韩国集中度风险正是
   本轮震中）。权重为站主当日主观判断，非投资建议（见 footnote）。 */
export const PICKS_ZH = [
  {tk:'MU',   name:'Micron Technology',    pct:18, why:'美国本土 HBM 独苗。韩系双雄巨震、SK 海力士放缓 HBM 扩产，供给纪律反而巩固其定价权；深度回调后前瞻估值已回到个位数区间，是后内存时代的<em>旗舰补给舰</em>。'},
  {tk:'AVGO', name:'Broadcom',             pct:15, why:'定制 ASIC 与以太网交换在巨头自研潮里两头收租；高位回撤逾两成而现金流护城河未损，仍是算力集群的<em>神经中枢</em>。'},
  {tk:'NVDA', name:'NVIDIA',               pct:14, why:'算力王座的<em>主力反应堆</em>。Meta 上调资本开支印证需求，出租算力动的是租赁商的蛋糕；回调至关键支撑带后，这里不再是拥挤交易。'},
  {tk:'MRVL', name:'Marvell Technology',   pct: 9, why:'光互连、定制硅与 CXL 布局，是穿越内存墙的<em>高速总线</em>；AI 溢价降温后性价比回升。'},
  {tk:'SNDK', name:'SanDisk',              pct: 8, why:'KV-Cache 分层把 NAND 拉进 AI 推理核心工作流；抛物线行情后的深回调是对<em>弹药库</em>的重新定价，刻意只配中等仓位。'},
  {tk:'WDC',  name:'Western Digital',      pct: 8, why:'AI 数据湖的近线存储底座，回调周里展现相对强势；HDD 供给纪律让它成为组合的<em>深空货舱</em>。'},
  {tk:'TER',  name:'Teradyne',             pct: 8, why:'HBM 堆叠层数越高、测试强度越陡峭——单层缺陷即整组报废。后端测试是这轮周期里最稳的<em>质检船坞</em>。'},
  {tk:'RMBS', name:'Rambus',               pct: 8, why:'内存接口 IP 的<em>收费站</em>：带宽扩容浪潮里毛利最高、beta 最低的一环，回调期的防御泊位。'},
  {tk:'ALAB', name:'Astera Labs',          pct: 6, why:'PCIe 6 / CXL 互连纯标的，机架级互联瓶颈的<em>跳线大师</em>；估值仍极贵，轻仓当期权押。'},
  {tk:'PSTG', name:'Pure Storage',         pct: 6, why:'全闪存阵列承接 KV-Cache 外溢需求，超大规模订单落地中；企业级闪存层的<em>前哨站</em>。'}
];

export const PICKS_EN = [
  {tk:'MU',   name:'Micron Technology',    pct:18, why:'The only US-soil HBM pure play. Korean turmoil and SK Hynix slowing HBM expansion tighten supply discipline in its favor; post-correction forward multiples sit back in single digits — the post-memory era\'s <em>flagship supply ship</em>.'},
  {tk:'AVGO', name:'Broadcom',             pct:15, why:'Custom ASICs and Ethernet switching collect rent on both sides of the hyperscaler self-silicon wave. Down over 20% from highs with the cash-flow moat intact — still the cluster\'s <em>nervous system</em>.'},
  {tk:'NVDA', name:'NVIDIA',               pct:14, why:'The compute throne\'s <em>main reactor</em>. Meta raising capex validates demand, and renting out surplus compute mostly eats the neoclouds\' lunch. Back at key support, no longer a crowded trade.'},
  {tk:'MRVL', name:'Marvell Technology',   pct: 9, why:'Optical interconnect, custom silicon and CXL: the <em>high-speed bus</em> through the memory wall, better priced after the AI premium cooled.'},
  {tk:'SNDK', name:'SanDisk',              pct: 8, why:'KV-cache tiering pulls NAND into the core AI inference loop. After a parabolic run and deep pullback, the <em>ammunition depot</em> gets repriced — deliberately sized medium.'},
  {tk:'WDC',  name:'Western Digital',      pct: 8, why:'Nearline backbone for AI data lakes; showed relative strength through the rout. Supply discipline makes it the fleet\'s <em>deep-space cargo hold</em>.'},
  {tk:'TER',  name:'Teradyne',             pct: 8, why:'Taller HBM stacks mean brutally steeper test intensity — one bad die scraps the whole stack. Back-end test is the cycle\'s steadiest <em>inspection dock</em>.'},
  {tk:'RMBS', name:'Rambus',               pct: 8, why:'The <em>toll booth</em> of memory-interface IP: the highest-margin, lowest-beta claim on the bandwidth build-out. The portfolio\'s defensive berth.'},
  {tk:'ALAB', name:'Astera Labs',          pct: 6, why:'The PCIe 6 / CXL interconnect pure play — <em>jumper master</em> of rack-scale bottlenecks. Still extremely expensive; a light position priced as an option.'},
  {tk:'PSTG', name:'Pure Storage',         pct: 6, why:'All-flash arrays catching KV-cache spillover as hyperscale wins land: the <em>forward outpost</em> of the enterprise flash tier.'}
];

export const COPY = {
  zh:{
    title:'Project Afflatus - 深空舰长日志',lang:'zh-CN',langBtn:'Dream in English',
    heroNum:'舰长航行纪要 · <span>034</span> · 深空资产舰队',
    heroTitle:'我在星宿一的辉光边缘统御舰群<br>把<em>资本</em>编入远征航线',
    heroDesc:'Feida 舰长的私人投资航海日志。这里没有喊单、带货或明日预言，只有一名孤独指挥官在 2026-07-04 公开自己的舱位比例、航向判断与风险纪律。',
    coord:'航向 · 奇点王座',scrollHint:'下潜至资产甲板',
    sl:['年化收益率','夏普比率 · 1Y','最大回撤','β 系数'],
    sf:['vs SPX +9.4 · vs QQQ +14.1','无风险利率 @ AU 10年 · 4.18%','2026-06-05 · 风险重置','组合相对 SPX · 2026 YTD'],
    s2num:'02 · <span>equity curve</span>',
    s2title:'每一根 K 线，都是舰桥穿过<em>虚空</em>的回波。',
    s2desc:'年初至今我个人组合的日 K 走势。蜡烛、均线与扫描光束同步展开，只为判断舰队是否仍沿着既定轨道航行。',
    chartSub:'private · daily · 2026 ytd',barsLabel:'bars · <b id="barCount">0</b>',
    s3num:'03 · <span>top 10 allocations · usa</span>',
    s3title:'我把远征舰队分成<em>十支编队</em>，每支都押上一段未来。',
    s3desc:'2026-07-04 换仓：存储与半导体板块深度回调之后，我认为后内存时代最值得持有的 10 支美股，以及我会分给它们的权重。比例条会在你看到它的瞬间自动爬升。',
    footnote:'上述权重为本人在当日的主观判断，不构成投资建议。任何标的都可能在你按下买入键的下一秒坠入引力井。研究你自己的航线，守住你自己的舱门。',
    f1:'afflatus · 深空舰长日志 · MMXXVI',f2:'no ads · no tips · no promises',f3:'signal origin · local stardate',
    distTarget:'目标距离', distEarth:'离开地球',
    picks:PICKS_ZH,
  },
  en:{
    title:'Project Afflatus - Deep-Space Captain Log',lang:'en',langBtn:'以中文入梦',
    heroNum:'Captain log · <span>034</span> · deep-space capital fleet',
    heroTitle:'At the glowline of Alphard<br>I command the fleet<br>and route <em>capital</em> into the dark',
    heroDesc:'Feida\'s private investment captain log. No tips, promotions, or prophecies. Just a lone commander disclosing 2026-07-04 positions, allocation logic, and the discipline that keeps the fleet alive.',
    coord:'bearing · singular throne',scrollHint:'descend to asset deck',
    sl:['Annualized Return','Sharpe · 1Y','Max Drawdown','Beta'],
    sf:['vs SPX +9.4 · vs QQQ +14.1','rf @ AU 10y · 4.18%','2026-06-05 · risk reset','portfolio vs SPX · 2026 YTD'],
    s2num:'02 · <span>equity curve</span>',
    s2title:'Every candle is an echo<br>from the command deck<br>crossing the <em>void</em>.',
    s2desc:'Daily candlestick chart of my personal portfolio, year-to-date. Candles, moving average and scan beam unfold together to show whether the fleet is still on course.',
    chartSub:'private · daily · 2026 ytd',barsLabel:'bars · <b id="barCount">0</b>',
    s3num:'03 · <span>top 10 allocations · usa</span>',
    s3title:'I divide the expedition into <em>ten fleets</em>,<br>each carrying a claim on the future.',
    s3desc:'Reallocated 2026-07-04, after the deep correction in memory and semis: the 10 US stocks I believe are most worth holding for the post-memory era, with the weight I would assign each. Allocation bars begin climbing the moment you see them.',
    footnote:'The above allocations reflect my personal judgment on this date and do not constitute investment advice. Any position can fall into a gravity well the second you hit buy. Study your own route and protect your own cargo.',
    f1:'afflatus · deep-space captain log · MMXXVI',f2:'no ads · no tips · no promises',f3:'signal origin · local stardate',
    distTarget:'TARGET DIST', distEarth:'DAYS FROM EARTH',
    picks:PICKS_EN,
  },
};

export const HUD_COPY = {
  zh:{
    wake:'战术尾迹 · 引力井前方', sub:'舰桥锁定 · 目标神谕 · 信号帷幕',
    radarTitle:'雷达', battleTitle:'防御模块', pilotTitle:'作战视角', systemsTitle:'动力损管', hangarTitle:'舰长终端', weaponLabel:'彗星截击裁决', uplink:'舰队遥测',
    options:['自动 · 舰长裁决火力','密集阵 · 左右舷近防弹幕','F-47 · 自主制导导弹','B2 · 战术核打击护航','执法者主炮 · 冷却30秒'],
    core:'反应堆核心', thrusters:'推进阵列', shield:'主炮冷却', scan:'巡航速度',
    armed:'待命', low:'低', navLock:'导航锁定', stable:'稳定', radarSweep:'雷达扫描', active:'激活', warningClass:'警戒等级', yellow:'黄色',
    killsLabel:'确认击毁', bayLabel:'舰载机库存', bomberLabel:'战略机库存', recommendLabel:'系统推荐', manualLabel:'手动选择', apAuto:'自动', apManual:'手动', maintenanceLabel:'机库维护', ammoLabel:'弹药', deviceLabel:'机体', bayCdLabel:'甲板', radarG:'过载', radarAzimuth:'方位角', radarCruise:'巡航', sideProfile:'母舰侧视', rearProfile:'尾部推进',
    wCannon:'密集阵', wMissile:'导弹', wNuke:'核打击', wEnforcer:'主炮',
    battleReady:'战术甲板待命 · 入梦按钮预热跃迁',
    fleet:'舰队遥测', origin:'离开地球', coreReserves:'核心储备', hull:'舰体完整', vector:'命运矢量',
    sensor:'虚空传感阵列', abyss:'航行日数', target:'目标神谕', warp:'跃迁功率', veil:'信号帷幕',
    idle:'待机', clean:'清澈', ly:'光年',
    targetNotify:'目标进入瞄准线 · 可手动覆写火力裁决', threat:['低','中','高','灾难'], heading:'航向', speed:'速度', threatLabel:'威胁', intercept:'拦截概率',
    logWeapon:'武器裁决已选择', logSmall:'小型彗星 · 左右舷密集阵近防弹幕拦截', logMedium:'中型彗星 · F-47 伴飞并释放自主制导导弹', logLarge:'大型彗星 · 核污染预警 · 聚变打击在途', logEnforcerCharge:'执法者主炮协议 · T-', logNuke:'核聚变打击在途 · T-', logCooldown:'执法者主炮冷却 · ', logDestroyed:'目标摧毁 · 确认击毁 ',
    nukeWarn:'警报，侦测到在途的核聚变打击！', fusion:'警报，侦测到在途的核聚变打击！', enforcerWarn:'执法者主炮', brace:'全员准备冲击 · T-', cooling:'主武器冷却', reload:'执法者主炮装载循环 · 30秒', ready:'就绪'
  },
  en:{
    wake:'TACTICAL WAKE · GRAVITY WELL AHEAD', sub:'COMMAND DECK LOCK · TARGET ORACLE · SIGNAL VEIL',
    radarTitle:'RADAR', battleTitle:'DEFENSE MODULE', pilotTitle:'COMBAT VIEW', systemsTitle:'PROPULSION / DAMAGE', hangarTitle:'COMMANDER TERMINAL', weaponLabel:'COMET INTERCEPT JUDGMENT', uplink:'FLEET TELEMETRY',
    options:['AUTO · recommended force','PHALANX · PORT / STARBOARD CIWS','F-47 · AUTONOMOUS AAM','B2 · TACTICAL NUKE + ESCORT','ENFORCER MAIN CANNON · 30S COOLDOWN'],
    core:'POWER CORE', thrusters:'THRUSTERS', shield:'MAIN GUN CD', scan:'CRUISE SPEED',
    armed:'ARMED', low:'LOW', navLock:'NAV LOCK', stable:'STABLE', radarSweep:'RADAR SWEEP', active:'ACTIVE', warningClass:'WARNING CLASS', yellow:'YELLOW',
    killsLabel:'CONFIRMED KILLS', bayLabel:'FIGHTER BAY', bomberLabel:'BOMBER BAY', recommendLabel:'SYSTEM RECOMMENDS', manualLabel:'MANUAL OVERRIDE', apAuto:'AUTO', apManual:'MANUAL', maintenanceLabel:'BAY SERVICE', ammoLabel:'AMMO', deviceLabel:'AIRFRAME', bayCdLabel:'DECK', radarG:'G LOAD', radarAzimuth:'AZIMUTH', radarCruise:'CRUISE', sideProfile:'MOTHERSHIP SIDE', rearProfile:'AFT DRIVE',
    wCannon:'CIWS', wMissile:'MISSILE', wNuke:'NUKE', wEnforcer:'MAIN GUN',
    battleReady:'TACTICAL DECK STANDING BY · DREAM SWITCH PRIMES WARP',
    fleet:'FLEET TELEMETRY', origin:'DAYS FROM EARTH', coreReserves:'CORE RESERVES', hull:'HULL INTEGRITY', vector:'FATE VECTOR',
    sensor:'VOID SENSOR LINE', abyss:'VOYAGE DAYS', target:'TARGET ORACLE', warp:'WARP DRAW', veil:'SIGNAL VEIL',
    idle:'IDLE', clean:'CLEAN', ly:'LY',
    targetNotify:'TARGET IN SIGHT · MANUAL FIRE OVERRIDE AVAILABLE', threat:['LOW','MEDIUM','HIGH','CATASTROPHIC'], heading:'HDG', speed:'VEL', threatLabel:'THREAT', intercept:'INTERCEPT P',
    logWeapon:'weapon AI selected', logSmall:'small comet · port and starboard Phalanx CIWS barrage intercept', logMedium:'medium comet · F-47 wing shadowing target · autonomous AAM release', logLarge:'large comet · nuclear pollution warning · fusion strike inbound', logEnforcerCharge:'enforcer cannon firing protocol · T-', logNuke:'nuclear fusion strike inbound · T-', logCooldown:'enforcer main cannon cooling · ', logDestroyed:'target destroyed · confirmed kills ',
    nukeWarn:'WARNING: INBOUND NUCLEAR FUSION STRIKE DETECTED', fusion:'WARNING: INBOUND NUCLEAR FUSION STRIKE DETECTED', enforcerWarn:'ENFORCER MAIN CANNON', brace:'all hands brace · T-', cooling:'MAIN WEAPON COOLING', reload:'enforcer cannon reload cycle · 30 seconds', ready:'READY'
  }
};

export function getHudCopy(key, lang = 'zh') {
  return (HUD_COPY[lang] || HUD_COPY.zh)[key] || HUD_COPY.en[key] || key;
}
