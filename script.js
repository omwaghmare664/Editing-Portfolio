/* Om Visuals — script.js
   No dependencies. Every feature fails safe: if anything here breaks, the page stays fully readable.
   Loaded with `defer`, so the DOM is ready. The theme and .js flag are already set inline in <head>. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Theme toggle ---------- */
  var toggle = document.getElementById('theme-toggle');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var THEME_COLORS = { dark: '#101312', light: '#f4f6f3' };

  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    if (themeMeta) themeMeta.setAttribute('content', THEME_COLORS[t]);
    if (toggle) toggle.setAttribute('aria-pressed', String(t === 'light'));
  }
  applyTheme(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  /* ---------- Nav: border once scrolled + current section ---------- */
  var nav = document.querySelector('.nav');
  function onScroll() { if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if ('IntersectionObserver' in window) {
    var links = document.querySelectorAll('.nav-links a[href^="#"]');
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.removeAttribute('aria-current'); });
        var a = map[e.target.id];
        if (a) a.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) {
      var s = document.getElementById(id);
      if (s) spy.observe(s);
    });
  }

  /* ---------- Scroll reveal ----------
     Content is only hidden (via .reveal-on) when IntersectionObserver exists and motion is allowed.
     Anything already in view is revealed straight away, so nothing waits on a late event.
     A timeout failsafe reveals everything if the observer never fires. */
  var items = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion && items.length) {
    root.classList.add('reveal-on');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
    window.setTimeout(function () {
      items.forEach(function (el) { el.classList.add('in'); });
    }, 4000);
  }

  /* ---------- Click-to-play video (no YouTube code loads until a visitor asks for it) ---------- */
  function playVideo(tile) {
    var id = tile.getAttribute('data-yt');
    if (!id || tile.classList.contains('is-playing')) return;
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
    f.title = tile.getAttribute('data-title') || 'Video';
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    tile.classList.add('is-playing');
    tile.appendChild(f);
    tile.removeAttribute('href');       /* stops the link re-firing while playing */
    tile.setAttribute('role', 'group');
    f.focus();
  }
  document.querySelectorAll('.vid[data-yt]').forEach(function (tile) {
    tile.addEventListener('click', function (e) { e.preventDefault(); playVideo(tile); });
  });

  /* ---------- Work page: category filter ---------- */
  var chips = document.querySelectorAll('.chip[data-filter]');
  if (chips.length) {
    var groups = document.querySelectorAll('.work-group');
    var none = document.querySelector('.filter-empty');
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var f = chip.getAttribute('data-filter');
        chips.forEach(function (c) {
          var on = c === chip;
          c.classList.toggle('is-active', on);
          c.setAttribute('aria-pressed', String(on));
        });
        groups.forEach(function (g) {
          g.hidden = !(f === 'all' || g.getAttribute('data-cat') === f);
        });
        if (none) none.hidden = true;
      });
    });
  }

  /* ---------- Enquiry form: Web3Forms (sends straight to your inbox) ---------- */
  var form = document.getElementById('enquiry');
  if (form) {
    var status = form.querySelector('.form-status');
    var btn = form.querySelector('button[type="submit"]');
    var label = btn ? btn.textContent : '';

    function say(msg, bad) {
      if (!status) return;
      status.textContent = msg;
      status.style.color = bad ? '#ff8a7a' : '';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      /* Spam trap: real visitors never tick this hidden box. */
      var trap = form.querySelector('input[name="botcheck"]');
      if (trap && trap.checked) return;

      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      say('');

      fetch(form.action, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      })
        .then(function (r) { return r.json().catch(function () { return { success: false }; }); })
        .then(function (d) {
          if (d && d.success) {
            form.reset();
            say('Thank you. Your enquiry has been sent and I will reply by email.');
          } else {
            say('Something went wrong sending the form. Please email omwaghmare664@gmail.com directly.', true);
          }
        })
        .catch(function () {
          say('Could not reach the server. Check your connection or email omwaghmare664@gmail.com directly.', true);
        })
        .then(function () {
          if (btn) { btn.disabled = false; btn.textContent = label; }
        });
    });
  }
})();
