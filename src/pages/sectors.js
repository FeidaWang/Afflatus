import './sectorsLibs.js';
import dataUrl from '../sectors/observatory/data.json?url';
import {initObservatory} from '../sectors/observatory/controller.js';
// Keep the evidence snapshot as data instead of parsing it as JavaScript.
fetch(dataUrl).then(response => {
  if (!response.ok) throw new Error('Snapshot unavailable');
  return response.json();
}).then(initObservatory).catch(() => {
  const notice = document.createElement('p');
  notice.setAttribute('role', 'status');
  notice.textContent = document.documentElement.lang.startsWith('zh')
    ? '产业数据暂不可用，请稍后重试。' : 'Industry data is unavailable. Please try again later.';
  document.querySelector('main')?.append(notice);
});
