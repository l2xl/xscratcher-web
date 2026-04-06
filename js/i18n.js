/* =========================================================
   Language detection & redirect
   Include in <head> of English pages only.
   Non-English pages use their own inline script for the EN switcher.

   Locale support is dynamic: the script detects the browser language,
   then probes whether a matching subfolder exists on the server.
   No locale names are hardcoded here — any /<lang>/ directory that
   responds with HTTP 200 is treated as a valid locale.
   ========================================================= */
(function () {
  'use strict';

  var STORAGE_KEY = 'tsp_lang';
  var saved = localStorage.getItem(STORAGE_KEY);

  // User explicitly chose English — do nothing
  if (saved === 'en') return;

  // Extract primary language subtag, e.g. "ru" from "ru-RU"
  var lang = (navigator.language || navigator.userLanguage || '').toLowerCase();
  var langCode = lang.split('-')[0];

  // Nothing to do for English or empty/unknown codes
  if (!langCode || langCode === 'en') return;

  var path = location.pathname;

  // Already inside a locale subdirectory (first segment is a 2–3 letter code)?
  // e.g. /ru/, /de/, /zh/ — bail out to avoid redirect loops
  var firstSegment = path.split('/').filter(Boolean)[0] || '';
  if (/^[a-z]{2,3}$/.test(firstSegment)) return;

  // Build the target URL for this locale, preserving the current page path
  var targetPath = '/' + langCode + (path === '/' ? '/index.html' : path);

  // Probe the target path. Only redirect if the locale subfolder actually exists.
  var xhr = new XMLHttpRequest();
  xhr.open('HEAD', targetPath, /* async= */ true);
  xhr.onload = function () {
    if (xhr.status >= 200 && xhr.status < 300) {
      location.replace(targetPath);
    }
    // Non-200 means the locale folder / page doesn't exist — stay on English
  };
  xhr.onerror = function () { /* network error — stay on English */ };
  xhr.send();
})();
