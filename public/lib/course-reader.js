import './header-controller.js';
const progress=document.querySelector('.reading-progress');
let frame=0;
function paint(){frame=0;const range=document.documentElement.scrollHeight-innerHeight;progress?.style.setProperty('--read-progress',String(range>0?Math.min(1,Math.max(0,scrollY/range)):0));}
function queue(){if(!frame)frame=requestAnimationFrame(paint);}
addEventListener('scroll',queue,{passive:true});addEventListener('resize',queue);addEventListener('pageshow',queue);paint();
const toc=document.querySelector('.reader-toc details');
if(toc&&matchMedia('(max-width:760px)').matches)toc.open=false;
if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;document.querySelectorAll('.reader-toc nav a').forEach(a=>{if(a.hash===`#${entry.target.id}`)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}},{rootMargin:'-100px 0px -60% 0px'});document.querySelectorAll('.lesson-prose h2,.lesson-prose h3').forEach(h=>observer.observe(h));}
document.querySelectorAll('[hreflang]').forEach(link=>link.addEventListener('click',()=>{try{const value=link.hreflang.startsWith('zh')?'zh':'en';localStorage.setItem('afflatus:locale:v1',value);}catch{ /* Navigation still works without storage. */ }}));
