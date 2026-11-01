(function(){const q=new URLSearchParams(location.search);const zh=q.get('lang')==='zh';document.documentElement.lang=zh?'zh-CN':'en';
if(zh){document.querySelectorAll('[data-zh]').forEach(e=>{e.textContent=e.getAttribute('data-zh')});}
if(q.get('open')){const g=document.querySelector('[data-grp="'+q.get('open')+'"]');if(g)g.setAttribute('data-open','');}
if(q.get('related')){const p=document.querySelector('#pop-'+q.get('related'));if(p){p.setAttribute('data-open','');const b=p.parentElement.querySelector('.more');if(b)b.setAttribute('aria-expanded','true');}}
if(q.get('menu')){const o=document.querySelector('.ov');if(o)o.setAttribute('data-open','');}
if(q.get('note')){const n=document.createElement('div');n.className='note';n.textContent=q.get('note');document.body.appendChild(n);}
document.querySelectorAll('.more').forEach(b=>b.addEventListener('click',()=>{const p=b.closest('.card,.lm-card').querySelector('.pop');const on=p.hasAttribute('data-open');document.querySelectorAll('.pop').forEach(x=>x.removeAttribute('data-open'));document.querySelectorAll('.more').forEach(x=>x.setAttribute('aria-expanded','false'));if(!on){p.setAttribute('data-open','');b.setAttribute('aria-expanded','true');}}));
document.querySelectorAll('.pop .x').forEach(b=>b.addEventListener('click',()=>{b.closest('.pop').removeAttribute('data-open');}));
document.querySelectorAll('.grp>button').forEach(b=>b.addEventListener('click',()=>{const g=b.parentElement;const on=g.hasAttribute('data-open');document.querySelectorAll('.grp').forEach(x=>x.removeAttribute('data-open'));if(!on)g.setAttribute('data-open','');}));
document.querySelectorAll('.burger').forEach(b=>b.addEventListener('click',()=>document.querySelector('.ov').setAttribute('data-open','')));
document.querySelectorAll('.ov .x').forEach(b=>b.addEventListener('click',()=>document.querySelector('.ov').removeAttribute('data-open')));
})();
