(function () {
  'use strict';
  window.AfflatusFetchJson = function (key, options) {
    if (window.AfflatusData && typeof window.AfflatusData.fetchJson === 'function') {
      return window.AfflatusData.fetchJson(key, options);
    }
    return new Promise(function (resolve) {
      window.addEventListener('afflatus-data-ready', function (event) {
        resolve(event.detail.fetchJson(key, options));
      }, { once: true });
    });
  };
})();
