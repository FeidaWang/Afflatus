/* 2026-08-02 AI factory conviction map：不再把组合压在单一存储周期上，
   而是沿“计算 → 定制硅/网络 → 云分发 → 先进制造 → HBM → 以太网 →
   电力与散热”整条 AI 工厂价值链配置。权重综合截至当日可获得的公司披露、
   需求能见度、执行质量、估值与单点风险；它是站主的研究快照，不是投资建议。 */
export const PICKS_ZH = [
  {tk:'NVDA', name:'NVIDIA',               pct:16, why:'加速器、网络与软件组成最完整的 AI 工厂平台；数据中心需求仍在高速扩张。它是舰队的<em>主反应堆</em>，但出口限制与高预期决定了仓位不能失控。'},
  {tk:'AVGO', name:'Broadcom',             pct:14, why:'定制 AI 加速器与以太网交换同时受益于超大规模客户自研潮，软件现金流又提供缓冲，是集群内部不可替代的<em>神经总线</em>。'},
  {tk:'MSFT', name:'Microsoft',            pct:12, why:'Azure、Copilot 与企业分发把模型能力直接送进工作流；当前约束更像供给而非需求。资本开支沉重，但它拥有最清晰的<em>商业化舱门</em>。'},
  {tk:'TSM',  name:'TSMC',                 pct:12, why:'先进制程与先进封装仍是整条 AI 供应链最难绕开的制造咽喉。技术领先提供护城河，地缘风险则要求保留<em>安全距离</em>。'},
  {tk:'AMZN', name:'Amazon',               pct:11, why:'AWS 同时掌握云需求、Trainium 芯片经济性与 Bedrock 智能体入口；既卖算力又改造算力成本，是舰队的<em>分发母港</em>。'},
  {tk:'GOOGL',name:'Alphabet',             pct:10, why:'搜索现金引擎、Gemini、TPU 与 Google Cloud 构成少数真正端到端的 AI 平台。监管与搜索迁移是风险，也是估值没有完全失重的原因。'},
  {tk:'MU',   name:'Micron Technology',    pct: 8, why:'HBM4 量产让它直接站在带宽瓶颈上；供给纪律可把技术升级转成定价权。但内存周期极端，故只把它作为<em>高能补给舰</em>。'},
  {tk:'ANET', name:'Arista Networks',      pct: 7, why:'AI 集群向 800G 与 1.6T 以太网演进，Arista 用软件与交换平台承接东西向流量爆发；客户集中和建设周期限制仓位。'},
  {tk:'VRT',  name:'Vertiv',               pct: 6, why:'电力、液冷与热管理已从幕后设备变成 AI 数据中心的物理瓶颈。订单能见度强，但市场预期同样很高，定位为<em>生命维持系统</em>。'},
  {tk:'AMD',  name:'Advanced Micro Devices',pct:4, why:'MI450、Helios 与 EPYC 提供最可信的第二套加速计算路线；软件生态和执行仍需验证，因此把它控制为一张<em>非对称期权</em>。'}
];

export const PICKS_EN = [
  {tk:'NVDA', name:'NVIDIA',               pct:16, why:'The most complete AI-factory platform across accelerators, networking and software, with data-center demand still expanding fast. The fleet\'s <em>main reactor</em>—sized below dominance because export controls and expectations remain real risks.'},
  {tk:'AVGO', name:'Broadcom',             pct:14, why:'Custom AI accelerators and Ethernet both ride hyperscaler self-silicon, while software cash flow adds ballast. It remains the cluster\'s essential <em>neural bus</em>.'},
  {tk:'MSFT', name:'Microsoft',            pct:12, why:'Azure, Copilot and enterprise distribution move model capability directly into workflows; supply looks tighter than demand. Capex is heavy, but it owns the clearest <em>monetization airlock</em>.'},
  {tk:'TSM',  name:'TSMC',                 pct:12, why:'Leading-edge process and advanced packaging remain the hardest manufacturing choke point to route around. Technical leadership is the moat; geopolitics sets the <em>safety distance</em>.'},
  {tk:'AMZN', name:'Amazon',               pct:11, why:'AWS owns cloud demand, Trainium silicon economics and the Bedrock agent gateway. It sells compute while redesigning its cost curve—the fleet\'s <em>distribution harbor</em>.'},
  {tk:'GOOGL',name:'Alphabet',             pct:10, why:'Search cash flow, Gemini, TPUs and Google Cloud form one of very few end-to-end AI platforms. Regulation and search migration are risks—and why expectations have not fully escaped gravity.'},
  {tk:'MU',   name:'Micron Technology',    pct: 8, why:'HBM4 volume shipments put Micron directly on the bandwidth bottleneck, where supply discipline can become pricing power. Memory is violently cyclical, so it stays a <em>high-energy supply ship</em>.'},
  {tk:'ANET', name:'Arista Networks',      pct: 7, why:'As AI fabrics move through 800G into 1.6T Ethernet, Arista\'s software and switching platform carries the east-west traffic surge. Customer concentration and build cycles cap the weight.'},
  {tk:'VRT',  name:'Vertiv',               pct: 6, why:'Power, liquid cooling and thermal management have become physical AI-datacenter bottlenecks. Visibility is strong, expectations are high: the portfolio\'s <em>life-support system</em>.'},
  {tk:'AMD',  name:'Advanced Micro Devices',pct:4, why:'MI450, Helios and EPYC offer the most credible second route in accelerated computing. Software and execution still need proof, so it remains an <em>asymmetric option</em>.'}
];

export const COPY = {
  zh:{
    title:'Project Afflatus - 深空舰长日志',lang:'zh-CN',langBtn:'Dream in English',
    heroNum:'FY25/26 · <span>资本飞行记录仪</span> · 财年战后报告',
    heroTitle:'我让资本高速跃迁<br>回撤则提醒我<br>速度的<em>代价</em>',
    heroDesc:'一份私人的 2025—26 财年交易记录：只公开收益率、持有周期与风险口径，不展示本金、成交金额或账户余额。',
    coord:'坐标 · FY25/26 资本黑匣子',scrollHint:'下潜至财年记录',
    sl:['账户级年化 · 模型估算','夏普比率 · 估算','最大回撤 · 估算','β 系数 · 估算'],
    sf:['资本时间重建 · 非审计结果','无风险利率输入 · 4.50%','2026-06-16—25 · 重建区间','科技集中组合相对 SPX'],
    s2num:'02 · <span>FY25/26 资本黑匣子</span>',
    s2title:'收益从来不只是一个数字。<br>它是一整条<em>假设链</em>。',
    s2desc:'这份报告将已结清交易事实、短周期年化与账户层面模型严格分层。三种口径回答三个不同问题，任何一个都不应被偷换成另一个。',
    chartSub:'private · daily · 2026 ytd',barsLabel:'bars · <b id="barCount">0</b>',
    s3num:'03 · <span>top 10 allocations · usa</span>',
    s3title:'八月的航线不只押一块芯片，<br>而是整座 <em>AI 工厂</em>。',
    s3desc:'2026-08-02 研究快照：我把最看好的 10 支美股沿算力、定制硅、云、晶圆制造、HBM、网络与电力散热重新编队。权重同时考虑需求能见度、执行质量、估值与单点风险。',
    footnote:'这是本人截至 2026-08-02 的主观研究与配置框架，不构成投资建议，也不承诺未来表现。财报、估值与风险条件会变化；研究你自己的航线，守住你自己的舱门。',
    f1:'afflatus · 深空舰长日志 · MMXXVI',f2:'no ads · no tips · no promises',f3:'signal origin · local stardate',
    distTarget:'目标距离', distEarth:'离开地球',
    picks:PICKS_ZH,
  },
  en:{
    title:'Project Afflatus - Deep-Space Captain Log',lang:'en',langBtn:'以中文入梦',
    heroNum:'FY25/26 · <span>capital flight recorder</span> · after-action report',
    heroTitle:'I made capital move fast.<br>The drawdown taught me<br>what speed <em>costs</em>.',
    heroDesc:'A private FY2025–26 trading record showing return, holding period and risk methodology—never principal, transaction amounts or account balance.',
    coord:'coordinates · FY25/26 capital black box',scrollHint:'descend to financial-year record',
    sl:['Account annual return · modeled','Sharpe ratio · estimated','Max drawdown · estimated','Beta · estimated'],
    sf:['capital-time reconstruction · not audited','risk-free input · 4.50%','2026-06-16—25 · reconstructed range','technology concentration vs SPX'],
    s2num:'02 · <span>FY25/26 capital black box</span>',
    s2title:'Return is not one number.<br>It is a chain of <em>assumptions</em>.',
    s2desc:'This report separates closed-trade facts from short-cycle annualization and account-level modeling. Each layer answers a different question; none may be silently substituted for another.',
    chartSub:'private · daily · 2026 ytd',barsLabel:'bars · <b id="barCount">0</b>',
    s3num:'03 · <span>top 10 allocations · usa</span>',
    s3title:'The August route is not one chip.<br>It is the <em>entire AI factory</em>.',
    s3desc:'Research snapshot · 2026-08-02. My 10 highest-conviction US listings now span compute, custom silicon, cloud, foundry, HBM, networking, power and cooling. Weights balance demand visibility, execution, valuation and single-point risk.',
    footnote:'This is my subjective research and allocation framework as of 2026-08-02—not investment advice or a promise of future performance. Earnings, valuations and risks change. Study your own route and protect your own cargo.',
    f1:'afflatus · deep-space captain log · MMXXVI',f2:'no ads · no tips · no promises',f3:'signal origin · local stardate',
    distTarget:'TARGET DIST', distEarth:'DAYS FROM EARTH',
    picks:PICKS_EN,
  },
};

export const HUD_COPY = {
  zh:{
    wake:'战术尾迹 · 引力井前方', sub:'舰桥锁定 · 目标神谕 · 信号帷幕',
    radarTitle:'雷达', battleTitle:'四联防御与火控', pilotTitle:'舰桥战术态势', systemsTitle:'战斗情报与损管', hangarTitle:'舰长终端', weaponLabel:'彗星截击裁决', uplink:'舰队遥测',
    options:['自动 · 舰长裁决火力','密集阵 · 左右舷近防弹幕','F-47 · 自主制导导弹','B2 · 战术核打击护航','执法者主炮 · 冷却30秒'],
    core:'反应堆核心', thrusters:'推进阵列', shield:'主炮冷却', scan:'巡航速度',
    armed:'待命', low:'低', navLock:'导航锁定', stable:'稳定', radarSweep:'雷达扫描', active:'激活', warningClass:'警戒等级', yellow:'黄色',
    killsLabel:'确认击毁', bayLabel:'舰载机库存', bomberLabel:'战略机库存', recommendLabel:'系统推荐', manualLabel:'手动选择', apAuto:'自动', apManual:'手动', maintenanceLabel:'机库维护', ammoLabel:'弹药', deviceLabel:'机体', bayCdLabel:'甲板', radarG:'过载', radarAzimuth:'方位角', radarCruise:'巡航', sideProfile:'母舰侧视', rearProfile:'尾部推进',
    wCannon:'密集阵', wMissile:'导弹', wNuke:'核打击', wEnforcer:'主炮',
    wCannonDesc:'近防弹幕', wMissileDesc:'自主制导', wNukeDesc:'双钥授权', wEnforcerDesc:'粒子脊柱',
    sensorFusion:'传感器融合 · 舰桥视角', cicCaption:'CIC 战术传感图',
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
    radarTitle:'RADAR', battleTitle:'FIRE CONTROL', pilotTitle:'CIC SENSOR PICTURE', systemsTitle:'TACTICAL FEED / CONDITION', hangarTitle:'COMMANDER TERMINAL', weaponLabel:'COMET INTERCEPT JUDGMENT', uplink:'FLEET TELEMETRY',
    options:['AUTO · recommended force','PHALANX · PORT / STARBOARD CIWS','F-47 · AUTONOMOUS AAM','B2 · TACTICAL NUKE + ESCORT','ENFORCER MAIN CANNON · 30S COOLDOWN'],
    core:'POWER CORE', thrusters:'THRUSTERS', shield:'MAIN GUN CD', scan:'CRUISE SPEED',
    armed:'ARMED', low:'LOW', navLock:'NAV LOCK', stable:'STABLE', radarSweep:'RADAR SWEEP', active:'ACTIVE', warningClass:'WARNING CLASS', yellow:'YELLOW',
    killsLabel:'CONFIRMED KILLS', bayLabel:'FIGHTER BAY', bomberLabel:'BOMBER BAY', recommendLabel:'SYSTEM RECOMMENDS', manualLabel:'MANUAL OVERRIDE', apAuto:'AUTO', apManual:'MANUAL', maintenanceLabel:'BAY SERVICE', ammoLabel:'AMMO', deviceLabel:'AIRFRAME', bayCdLabel:'DECK', radarG:'G LOAD', radarAzimuth:'AZIMUTH', radarCruise:'CRUISE', sideProfile:'MOTHERSHIP SIDE', rearProfile:'AFT DRIVE',
    wCannon:'CIWS', wMissile:'MISSILE', wNuke:'NUKE', wEnforcer:'MAIN GUN',
    wCannonDesc:'POINT DEFENSE', wMissileDesc:'ACTIVE GUIDANCE', wNukeDesc:'TWO-KEY AUTH', wEnforcerDesc:'PARTICLE SPINE',
    sensorFusion:'SENSOR FUSION · BRIDGE VIEW', cicCaption:'CIC TACTICAL SENSOR PICTURE',
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
