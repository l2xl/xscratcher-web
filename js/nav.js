(function () {
  var btn = document.querySelector('.nav-toggle');
  var list = document.querySelector('.nav-links');
  if (!btn || !list) return;

  btn.addEventListener('click', function () {
    var open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', open ? 'false' : 'true');
    list.classList.toggle('nav-open', !open);
  });

  // Close when a nav link is tapped
  list.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      btn.setAttribute('aria-expanded', 'false');
      list.classList.remove('nav-open');
    }
  });

  // Close when viewport becomes wide enough
  window.addEventListener('resize', function () {
    if (window.innerWidth > 768) {
      btn.setAttribute('aria-expanded', 'false');
      list.classList.remove('nav-open');
    }
  });
})();
