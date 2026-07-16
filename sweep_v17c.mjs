import { createCombatHmdV3, drawCockpitFrame, drawSCHeadingTape, drawSCReticle } from './src/ui/combatHmdV3.js';

function mockCtx(){
  const noop=()=>{};
  const ctx={};
  const methods=['save','restore','beginPath','moveTo','lineTo','closePath','stroke','fill','fillRect','strokeRect','rect','arc','fillText','setLineDash','clip','translate','rotate','scale'];
  methods.forEach(m=>ctx[m]=noop);
  ctx.createLinearGradient=()=>({addColorStop:noop});
  ctx.createRadialGradient=()=>({addColorStop:noop});
  ctx.createConicGradient=()=>({addColorStop:noop});
  let _f='',_s='',_ls=1,_ga=1,_ta='left',_tb='alphabetic',_cop='source-over',_sb=0,_sc='black';
  Object.defineProperties(ctx,{
    fillStyle:{get:()=>_f,set:v=>_f=v},
    strokeStyle:{get:()=>_s,set:v=>_s=v},
    lineWidth:{get:()=>_ls,set:v=>_ls=v},
    globalAlpha:{get:()=>_ga,set:v=>_ga=v},
    textAlign:{get:()=>_ta,set:v=>_ta=v},
    textBaseline:{get:()=>_tb,set:v=>_tb=v},
    globalCompositeOperation:{get:()=>_cop,set:v=>_cop=v},
    font:{get:()=>_f,set:v=>_f=v},
    shadowBlur:{get:()=>_sb,set:v=>_sb=v},
    shadowColor:{get:()=>_sc,set:v=>_sc=v},
  });
  return ctx;
}

let errors=0;
const sizes=[[320,220],[420,320],[900,600],[1400,850]];
const halley={hp:140,destroyed:false,hover:true,vx:.3,vy:-.1,sizeClass:'medium',collisionRisk:.1,curX:200,curY:150,x:200,y:150};
const hmd=createCombatHmdV3({
  getHalley:()=>halley,
  getWarpIntensity:()=>.4,
  getShipRecoil:()=>0,
  pilotTrackedPoint:(w,h,mode)=>({visible:true,cx:w*.5,cy:h*.46,lock:.6,locked:false,approach:.3}),
  getKillCount:()=>3,
  getGiantKillCount:()=>0,
});

for(const [w,h] of sizes){
  for(const boot of [0,.3,.65,1]){
    for(const landing of [false,true]){
      try{ drawCockpitFrame(mockCtx(),w,h,1000,landing,boot); }catch(e){ errors++; console.error('cockpitFrame',w,h,boot,landing,e); }
    }
  }
  for(const hdg of [0,5,123,269,358]){
    try{ drawSCHeadingTape(mockCtx(),w,h,hdg); }catch(e){ errors++; console.error('headingTape',w,h,hdg,e); }
  }
  try{ drawSCReticle(mockCtx(),w*.5,h*.46); }catch(e){ errors++; console.error('reticle',w,h,e); }
  for(const mode of ['','ciws','missile','mainGun']){
    try{ hmd.drawCleanCombatHmd(mockCtx(),w,h,1000,'TARGET LINK',mode); }catch(e){ errors++; console.error('cleanCombatHmd',w,h,mode,e); }
  }
}
console.log(errors===0?'ALL OK':`${errors} ERRORS`);
