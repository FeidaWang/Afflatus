import { courseBookCatalog } from '../data/courseBookCatalog.js';
import { courseGroupCopy } from '../data/courseGroupCopy.js';
const language=()=>document.documentElement.lang.startsWith('zh')?'zh':'en';
const dialog=document.createElement('dialog');
dialog.className='course-book-dialog';
dialog.setAttribute('aria-labelledby','book-preview-title');
dialog.innerHTML='<button type="button" class="book-preview-close"></button><div class="book-preview-art"><img width="480" height="640"></div><div class="book-preview-copy"><p class="book-preview-week"></p><h2 id="book-preview-title"></h2><p class="book-preview-description"></p><p class="book-preview-theme"></p><a class="book-preview-read"></a></div>';
document.body.append(dialog);
let activeBook=null, opener=null, previousOverflow='';
function render(){
 if(!activeBook)return;
 const lang=language(),zh=lang==='zh',book=activeBook;
 const img=dialog.querySelector('img');img.src=book.covers[lang];img.alt=book.title[lang];
 dialog.querySelector('.book-preview-week').textContent=zh?`第 ${book.id} 周 / 24 · 个人 FDE`:`WEEK ${book.id} / 24 · PERSONAL FDE`;
 dialog.querySelector('h2').textContent=book.title[lang];
 dialog.querySelector('.book-preview-description').textContent=book.heading[lang];
 dialog.querySelector('.book-preview-theme').textContent=`${courseGroupCopy[book.group][zh?1:0]} · ${zh?'10 小时核心 + 2 小时机动':'10 core hours + 2 optional'}`;
 const link=dialog.querySelector('.book-preview-read');link.href=`/${lang}/course/book-${book.id}.html`;link.textContent=zh?'阅读全文 →':'Read more →';
 const close=dialog.querySelector('.book-preview-close');close.textContent=zh?'关闭 ×':'Close ×';close.setAttribute('aria-label',zh?'关闭书本预览':'Close book preview');
}
function updateLocale(){
 const lang=language();
 document.querySelectorAll('[data-book-preview]').forEach(a=>a.href=`/${lang}/course/book-${a.dataset.bookPreview}.html`);
 document.querySelectorAll('[data-cover-en]').forEach(img=>{img.src=img.dataset[lang==='zh'?'coverZh':'coverEn'];img.alt=img.dataset[lang==='zh'?'titleZh':'titleEn'];});
 document.querySelectorAll('[data-course-companion]').forEach(a=>a.href=`/${lang}/course/${a.dataset.courseCompanion}.html`);
 // Footer links follow the same route language as the masthead.
 document.querySelectorAll('.pa-footer a[href^="/"]').forEach(a=>{const path=a.getAttribute('href').replace(/^\/(en|zh)(?=\/)/,'');a.href=path==='/serial.html'?'/zh/serial.html':`/${lang}${path}`;});
 render();
}
document.addEventListener('click',event=>{
 const trigger=event.target.closest('[data-book-preview]');
 if(!trigger||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 if(typeof dialog.showModal!=='function')return;
 const book=courseBookCatalog.find(b=>b.id===trigger.dataset.bookPreview);if(!book)return;
 event.preventDefault();activeBook=book;opener=trigger;render();previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();
 dialog.querySelector('.book-preview-close').focus({preventScroll:true});
});
dialog.querySelector('button').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
dialog.addEventListener('close',()=>{document.body.style.overflow=previousOverflow;opener?.focus({preventScroll:true});activeBook=null;});
window.addEventListener('afflatus-lang',updateLocale);updateLocale();
