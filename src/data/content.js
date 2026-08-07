/* 2026-08-07 08:29 ET · PRE-NFP AI conviction map. This snapshot was frozen
   one minute before the scheduled July Employment Situation release. It
   incorporates the latest company disclosures available at that point:
   NVIDIA FY27 Q1, Broadcom FY26 Q2, AMD/Meta/Amazon/Microsoft FY26 Q2 or Q4,
   TSMC 2Q26, Micron FQ3, Vertiv Q2 and Oracle FY26 Q4. The ranking balances
   H2 revenue acceleration, backlog/visibility, execution and financing risk;
   it is a research view, not investment advice or a promise of performance. */
export const PICKS_ZH = [
  {tk:'NVDA', name:'NVIDIA', pct:18, layer:'太阳 / 算力核心', role:'AI 太阳系的恒星与能量源', catalyst:'FY27 Q1 数据中心收入同比增长 92%，Vera Rubin 把计算、网络与软件继续平台化。', risk:'对华出口限制、客户自研芯片、产品切换与极高预期。', why:'数据中心收入达到新的记录，Rubin、NVLink、Spectrum-X 与 CUDA 共同维持最完整的 AI 工厂平台。它是权重最高的<em>太阳</em>，也是整个系统最集中的单点风险。'},
  {tk:'AVGO', name:'Broadcom', pct:15, layer:'水星 / 定制硅与网络', role:'贴近算力核心的高速信号行星', catalyst:'FY26 Q2 AI 半导体收入同比增长 143%，公司预计 Q3 增速超过 200%。', risk:'客户集中、定制项目节奏、供应链与估值压缩。', why:'定制加速器和以太网同时承接超大规模客户扩张，像水星一样贴近算力太阳并高速传递信号；软件现金流提供<em>稳定引力</em>。'},
  {tk:'AMD', name:'Advanced Micro Devices', pct:13, layer:'金星 / 第二算力平台', role:'高温竞争轨道上的第二计算世界', catalyst:'Q2 数据中心收入同比增长 107%，Helios、MI400 与 EPYC 进入下半年放量阶段。', risk:'ROCm 生态、机架级交付、竞争性定价与路线图兑现。', why:'最新季度的数据中心业务已占公司收入 58%，并明确指向下半年加速。AMD 像金星一样明亮且高压，成为<em>第二算力世界</em>。'},
  {tk:'ORCL', name:'Oracle', pct:10, layer:'地球 / AI 云与数据库', role:'承载已预订算力需求的云端生态圈', catalyst:'FY26 Q4 OCI 收入增长 93%，RPO 达 6380 亿美元，Q1 云收入指引增长 58%—64%。', risk:'自由现金流为负、债务与股权融资、客户集中和交付资本强度。', why:'巨额 AI 合同把未来需求提前锁入 RPO，OCI 与多云数据库形成可以承载应用生态的<em>产业地球</em>；融资需求仍是高压天气。'},
  {tk:'AMZN', name:'Amazon', pct:9, layer:'火星 / 云与自研芯片', role:'持续扩建基础设施的算力前线', catalyst:'Q2 AWS 收入增长 37%，为 18 个季度最快，运营利润同比增长 64%。', risk:'AI 基建使自由现金流转负、折旧上升与云端竞争。', why:'AWS 在 Trainium、Bedrock 与大规模 GPU 服务之间同时优化需求和成本，像火星基地一样持续扩建，担当<em>推理前线</em>。'},
  {tk:'MSFT', name:'Microsoft', pct:9, layer:'木星 / 企业云与智能体', role:'以企业分发形成最大云端引力场', catalyst:'FY26 Q4 Azure 增长 43%，商业剩余履约义务增长 84%。', risk:'供给约束、AI 毛利压力、资本开支回报周期和伙伴依赖。', why:'Azure、Foundry、GitHub 与 Microsoft 365 共同形成木星般的企业引力场，把模型能力直接送入工作流；重资本投入压低<em>短期效率</em>。'},
  {tk:'TSM', name:'TSMC', pct:8, layer:'土星 / 先进制造', role:'由制程与封装光环守护的制造咽喉', catalyst:'Q2 收入达到指引上限，Q3 收入指引升至 446—458 亿美元。', risk:'台海地缘风险、汇率、海外扩产成本与半导体资本周期。', why:'领先制程与先进封装像土星环一样构成层层壁垒，是整条 AI 供应链最难绕开的<em>制造咽喉</em>。'},
  {tk:'GOOGL', name:'Alphabet', pct:7, layer:'天王星 / 模型与分发', role:'以自研 TPU 倾斜传统计算轴线', catalyst:'Gemini、TPU、搜索与 Google Cloud 形成从模型到现金流的闭环。', risk:'生成式答案重塑搜索经济、监管压力与高资本开支。', why:'TPU、Gemini、Cloud 与搜索分发形成端到端平台，像天王星的倾斜自转轴一样改变传统计算方向，并以广告现金流<em>自供能源</em>。'},
  {tk:'MU', name:'Micron Technology', pct:6, layer:'海王星 / 高带宽内存', role:'位于深蓝带宽边界的高能补给世界', catalyst:'FQ3 创纪录，HBM4 已大批量出货，Q4 收入与利润率指引再次跃升。', risk:'内存价格周期、扩产、客户认证节奏与高峰利润可持续性。', why:'HBM4 量产让 Micron 站在 AI 带宽瓶颈上，像海王星一样位于深蓝边界；强周期属性把仓位限制为<em>高能补给世界</em>。'},
  {tk:'VRT', name:'Vertiv', pct:5, layer:'冥王星 / 电力与液冷', role:'外缘却不可缺失的物理生命维持层', catalyst:'Q2 销售增长 24%、有机增长 18%，并上调全年关键指标指引。', risk:'高预期、供应链拥堵、大项目执行和数据中心延期。', why:'电力、液冷与热管理位于软件叙事的外缘，却是 AI 数据中心不可缺失的物理条件，像冥王星一样守在<em>系统边界</em>。'}
];

export const PICKS_EN = [
  {tk:'NVDA', name:'NVIDIA', pct:18, layer:'SUN / COMPUTE CORE', role:'The star and energy source of the AI system', catalyst:'FY27 Q1 Data Center revenue grew 92% as Vera Rubin extends compute into a full platform.', risk:'China export controls, customer silicon, transitions and exceptional expectations.', why:'Record Data Center demand plus Rubin, NVLink, Spectrum-X and CUDA preserve the most complete AI-factory platform. It is the highest-weight <em>sun</em>—and the system\'s largest single-point risk.'},
  {tk:'AVGO', name:'Broadcom', pct:15, layer:'MERCURY / CUSTOM SILICON + NETWORK', role:'Fast signal planet closest to the compute core', catalyst:'FY26 Q2 AI semiconductor revenue grew 143%; Q3 growth is guided above 200%.', risk:'Customer concentration, custom-program timing, supply and multiple compression.', why:'Custom accelerators and Ethernet capture hyperscale expansion, orbiting close to the compute sun like Mercury and carrying signals at speed. Software cash flow supplies <em>stable gravity</em>.'},
  {tk:'AMD', name:'Advanced Micro Devices', pct:13, layer:'VENUS / SECOND COMPUTE PLATFORM', role:'A second compute world on a high-pressure orbit', catalyst:'Q2 Data Center revenue grew 107%; Helios, MI400 and EPYC enter their H2 ramp.', risk:'ROCm adoption, rack delivery, competitive pricing and roadmap execution.', why:'Data Center reached 58% of company revenue and management expects H2 acceleration. Bright and high-pressure like Venus, AMD becomes a credible <em>second compute world</em>.'},
  {tk:'ORCL', name:'Oracle', pct:10, layer:'EARTH / AI CLOUD + DATABASE', role:'Cloud biosphere carrying booked compute demand', catalyst:'FY26 Q4 OCI grew 93%, RPO hit 638 billion and Q1 cloud growth is guided at 58%–64%.', risk:'Negative free cash flow, debt/equity funding, concentration and build intensity.', why:'Large AI contracts pull demand into visible RPO while OCI and multicloud database create an application-bearing <em>industry Earth</em>; financing remains severe weather.'},
  {tk:'AMZN', name:'Amazon', pct:9, layer:'MARS / CLOUD + CUSTOM SILICON', role:'The infrastructure frontier under continuous buildout', catalyst:'Q2 AWS grew 37%—the fastest in 18 quarters—and operating income rose 64%.', risk:'AI infrastructure pushed free cash flow negative; depreciation and competition rise.', why:'AWS combines Trainium, Bedrock and large GPU fleets, expanding like a Mars base while optimizing demand and unit economics—the system\'s <em>inference frontier</em>.'},
  {tk:'MSFT', name:'Microsoft', pct:9, layer:'JUPITER / ENTERPRISE CLOUD + AGENTS', role:'The largest enterprise-distribution gravity field', catalyst:'FY26 Q4 Azure grew 43% and commercial remaining performance obligation rose 84%.', risk:'Capacity, AI gross-margin pressure, capex payback and partner dependence.', why:'Azure, Foundry, GitHub and Microsoft 365 form a Jupiter-scale enterprise gravity field that pulls models into workflows; capital intensity limits <em>near-term efficiency</em>.'},
  {tk:'TSM', name:'TSMC', pct:8, layer:'SATURN / ADVANCED MANUFACTURING', role:'Process and packaging rings around the manufacturing choke point', catalyst:'Q2 revenue reached the guide ceiling; Q3 revenue is guided to 44.6–45.8 billion.', risk:'Taiwan geopolitics, currency, overseas-fab cost and the semiconductor cycle.', why:'Leading-edge process and packaging form Saturn-like rings of layered protection around the hardest AI supply-chain <em>manufacturing choke point</em>.'},
  {tk:'GOOGL', name:'Alphabet', pct:7, layer:'URANUS / MODEL + DISTRIBUTION', role:'A TPU platform tilting the traditional compute axis', catalyst:'Gemini, TPUs, Search and Google Cloud connect model capability to cash flow.', risk:'Generative answers reshape Search, regulation intensifies and capex remains high.', why:'TPUs, Gemini, Cloud and Search form an end-to-end platform that tilts the conventional compute axis like Uranus, powered by <em>self-generated cash flow</em>.'},
  {tk:'MU', name:'Micron Technology', pct:6, layer:'NEPTUNE / HIGH-BANDWIDTH MEMORY', role:'A high-energy world on the deep-blue bandwidth frontier', catalyst:'Record FQ3, HBM4 in volume shipment and another step-up in Q4 revenue/margin guidance.', risk:'Memory pricing cycles, expansion, qualification timing and peak-margin durability.', why:'HBM4 volume places Micron directly on the AI bandwidth bottleneck, a Neptune-like deep-blue frontier. Cyclicality keeps it a <em>high-energy supply world</em>.'},
  {tk:'VRT', name:'Vertiv', pct:5, layer:'PLUTO / POWER + LIQUID COOLING', role:'The distant but indispensable physical life-support layer', catalyst:'Q2 sales grew 24%, organic sales 18%, and full-year key-metric guidance was raised.', risk:'Elevated expectations, supply congestion, project execution and datacenter delays.', why:'Power and liquid cooling sit beyond the software narrative yet remain indispensable physical constraints, guarding the <em>system boundary</em> like Pluto.'}
];

export const COPY = {
  zh:{
    title:'Project Afflatus - 深空舰长日志',lang:'zh-CN',langBtn:'Dream in English',
    heroNum:'FY25/26 · <span>资本飞行记录仪</span> · 财年战后报告',
    heroTitle:'我让资本高速跃迁<br>回撤则提醒我<br>速度的<em>代价</em>',
    heroDesc:'一份私人的 2025—26 财年交易记录：只公开收益率、持有周期与风险口径，不展示本金、成交金额或账户余额。',
    coord:'坐标 · FY25/26 资本黑匣子',scrollHint:'下潜至财年记录',
    sl:['账户年化 · 上界','夏普比率 · 上界','最大回撤 · 上界','β 系数 · 上界'],
    sf:['模型估算 · 资本时间重建','估算 · 无风险利率输入 4.50%','估算 · 2026-06-16—25 窗口','估算 · 科技集中组合相对 SPX'],
    s2num:'02 · <span>FY25/26 资本黑匣子</span>',
    s2title:'收益从来不只是一个数字。<br>它是一整条<em>假设链</em>。',
    s2desc:'这份报告将已结清交易事实、短周期年化与账户层面模型严格分层。三种口径回答三个不同问题，任何一个都不应被偷换成另一个。',
    chartSub:'private · daily · 2026 ytd',barsLabel:'bars · <b id="barCount">0</b>',
    s3num:'03 · <span>top 10 allocations · usa</span>',
    s3title:'十个 AI 引力源，<br>组成一座实时运行的<em>产业太阳系</em>。',
    s3desc:'2026-08-07 08:29 ET · 非农发布前快照：最高权重 NVDA 是太阳，其余九支映射为水星至冥王星。星体按当前历元公转并依据真实自转方向动态演化；点击任意代码，可展开对应产业天体。',
    footnote:'这是本人截至 2026-08-07 08:29 ET、美国 7 月非农发布前的主观研究与配置框架，不构成投资建议，也不承诺未来表现。宏观数据、财报、估值与风险条件会变化；研究你自己的航线，守住你自己的舱门。',
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
    sl:['Annual return · upper bound','Sharpe · upper bound','Max drawdown · upper bound','Beta · upper bound'],
    sf:['modeled · capital-time reconstruction','estimated · risk-free input 4.50%','estimated · 2026-06-16—25 window','estimated · technology concentration vs SPX'],
    s2num:'02 · <span>FY25/26 capital black box</span>',
    s2title:'Return is not one number.<br>It is a chain of <em>assumptions</em>.',
    s2desc:'This report separates closed-trade facts from short-cycle annualization and account-level modeling. Each layer answers a different question; none may be silently substituted for another.',
    chartSub:'private · daily · 2026 ytd',barsLabel:'bars · <b id="barCount">0</b>',
    s3num:'03 · <span>top 10 allocations · usa</span>',
    s3title:'Ten AI gravity wells form<br>a live <em>industry solar system</em>.',
    s3desc:'2026-08-07 · 08:29 ET · PRE-NFP. Highest-weight NVDA is the sun; nine remaining names map from Mercury through Pluto. Bodies orbit from the current epoch and rotate in their real-world directions. Select any ticker to open its celestial atlas.',
    footnote:'This is my subjective research and allocation framework as of 2026-08-07 08:29 ET, before the July US payrolls release—not investment advice or a promise of future performance. Macro data, earnings, valuations and risks change. Study your own route and protect your own cargo.',
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
