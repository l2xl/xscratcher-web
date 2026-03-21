/* =========================================================
   Language detection & redirect
   Include in <head> of English pages only.
   Russian pages use their own inline script for the EN switcher.
   ========================================================= */
(function () {
  'use strict';

  var STORAGE_KEY = 'tsp_lang';
  var saved = localStorage.getItem(STORAGE_KEY);

  // If user explicitly chose English — do nothing
  if (saved === 'en') return;

  // Detect Russian browser
  var lang = (navigator.language || navigator.userLanguage || '').toLowerCase();
  var isRu = lang.indexOf('ru') === 0;

  if (!isRu) return;

  // Build the /ru/ equivalent of the current path
  var path = location.pathname;

  // Already on a /ru/ page — shouldn't happen but guard anyway
  if (path.indexOf('/ru/') === 0 || path === '/ru') return;

  // Map root paths to /ru/ equivalents
  var ruPath = '/ru' + (path === '/' ? '/index.html' : path);

  // Redirect
  location.replace(ruPath);
})();
