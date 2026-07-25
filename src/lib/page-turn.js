(() => {
  const prev = document.body.dataset.prev;
  const next = document.body.dataset.next;
  let turning = false;
  const turn = (url, dir) => {
    if (!url || turning) return;
    turning = true;
    document.body.classList.remove('turn-next', 'turn-prev');
    void document.body.offsetWidth;
    document.body.classList.add(dir === 'prev' ? 'turn-prev' : 'turn-next');
    setTimeout(() => { window.location.href = url; }, 240);
  };
  document.querySelectorAll('[data-page-turn]').forEach((link) => {
    const go = (event) => {
      event.preventDefault();
      event.stopPropagation();
      turn(link.getAttribute('href'), link.dataset.pageTurn);
    };
    link.addEventListener('click', go);
    link.addEventListener('pointerup', go);
  });
  window.addEventListener('keydown', (event) => {
    const interactive = event.target?.closest?.('a,button,input,textarea,select,canvas,[contenteditable="true"],[role="button"],[role="group"],[role="tab"],[role="slider"],[tabindex]');
    if (event.metaKey || event.ctrlKey || event.altKey || interactive) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      turn(prev, 'prev');
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      turn(next, 'next');
    }
  });
})();
