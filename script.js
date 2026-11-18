/* app.js: Lenis + GSAP + custom YouTube player */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- SVG icons (no emoji) ---------- */
const P = {
  play: '<polygon points="6 4 20 12 6 20 6 4"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  on: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  off: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/>'
};
const svg = (k, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="${/play|pause/.test(k) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[k]}</svg>`;
const store = {
  get: () => { try { return sessionStorage.getItem('unmuted') === '1'; } catch (e) { return false; } },
  set: () => { try { sessionStorage.setItem('unmuted', '1'); } catch (e) {} }
};
const fmt = s => { s = Math.max(0, s | 0); return (s / 60 | 0) + ':' + String(s % 60).padStart(2, '0'); };

/* ---------- VideoPlayer: YouTube with 100% custom UI ---------- */
class VideoPlayer {
  static all = []; static audible = null; static api = null;
  static load() {
    return VideoPlayer.api ||= new Promise((res, rej) => {
      if (window.YT && YT.Player) return res();
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev && prev(); res(); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api'; s.onerror = rej; document.head.appendChild(s);
    });
  }
  constructor(el) {
    this.el = el; this.id = (el.dataset.yt || '').trim();
    this.ready = false; this.want = false; this.playing = false; this.muted = true; this.pendingUnmute = false; this.drag = false;
    if (!this.id) return el.classList.add('error');
    el.style.setProperty('--zoom', el.dataset.zoom || 1);
    el.innerHTML = `
      <div class="poster" style="background-image:url(https://i.ytimg.com/vi/${this.id}/hqdefault.jpg)"></div>
      <div class="stage"><div class="mount"></div></div>
      <div class="shield"></div>
      <span class="tag glass dark">${el.dataset.label || ''}</span>
      <button class="unmute glass dark" aria-label="Unmute">${svg('off', 16)}<span>Tap to unmute</span></button>
      <div class="bar glass dark">
        <button class="pp" aria-label="Play or pause">${svg('pause')}</button>
        <div class="track"><div class="fill"></div></div>
        <span class="time">0:00 / 0:00</span>
        <button class="mu" aria-label="Mute or unmute">${svg('off')}</button>
      </div>
      <div class="err">This video can't be embedded. Check the ID or that embedding is allowed.</div>`;
    const q = s => $(s, el);
    this.mount = q('.mount'); this.fill = q('.fill'); this.time = q('.time'); this.track = q('.track');
    this.pp = q('.pp'); this.mu = q('.mu');
    q('.shield').onclick = () => this.toggle();
    this.pp.onclick = () => this.toggle();
    this.mu.onclick = () => this.muted ? this.unmute() : this.mute();
    q('.unmute').onclick = () => this.unmute();
    const seek = x => {
      if (!this.ready) return;
      const d = this.yt.getDuration(); if (!d) return;
      const r = this.track.getBoundingClientRect(), p = Math.min(1, Math.max(0, (x - r.left) / r.width));
      this.yt.seekTo(p * d, true); this.fill.style.width = p * 100 + '%'; this.time.textContent = fmt(p * d) + ' / ' + fmt(d);
    };
    this.track.addEventListener('pointerdown', e => { this.drag = true; this.track.setPointerCapture(e.pointerId); seek(e.clientX); });
    this.track.addEventListener('pointermove', e => this.drag && seek(e.clientX));
    ['pointerup', 'pointercancel'].forEach(t => this.track.addEventListener(t, () => this.drag = false));
    el.addEventListener('touchstart', () => el.classList.add('touch'), { passive: true });
    new IntersectionObserver(([e]) => e.isIntersecting ? this.enter() : this.leave(), { threshold: .5, rootMargin: el.classList.contains('tall') ? '0px -22% 0px -22%' : '0px' }).observe(el);
    VideoPlayer.all.push(this);
    VideoPlayer.load().then(() => this.init()).catch(() => el.classList.add('error'));
    setInterval(() => this.tick(), 250);
  }
  init() {
    const v = { controls: 0, disablekb: 1, fs: 0, modestbranding: 1, rel: 0, iv_load_policy: 3, cc_load_policy: 0, playsinline: 1, loop: 1, playlist: this.id, mute: 1, autoplay: 0 };
    if (location.protocol.startsWith('http')) v.origin = location.origin;
    this.yt = new YT.Player(this.mount, {
      host: 'https://www.youtube-nocookie.com', videoId: this.id, playerVars: v,
      events: {
        onReady: () => { this.ready = true; this.yt.mute(); if (this.want) this.yt.playVideo(); if (this.pendingUnmute) this.autoUnmute(); },
        onStateChange: e => this.sync(e.data),
        onError: () => this.el.classList.add('error')
      }
    });
  }
  sync(s) {
    this.last = s; this.playing = s === 1 || s === 3;
    if (s === 1) this.el.classList.add('started');
    if (s === 1 || s === 3) this.el.classList.remove('paused');
    else if (s === 2 || s === 0) this.el.classList.add('paused');
    this.icons();
  }
  icons() { this.pp.innerHTML = svg(this.playing ? 'pause' : 'play'); this.mu.innerHTML = svg(this.muted ? 'off' : 'on'); this.el.classList.toggle('sound', !this.muted); }
  tick() {
    if (!this.ready || this.drag) return;
    const st = this.yt.getPlayerState(); if (st !== this.last) this.sync(st);   // self-heal: thumbnail can never stay stuck
    if (!this.playing) return;
    const d = this.yt.getDuration(), c = this.yt.getCurrentTime(); if (!d) return;
    this.fill.style.width = c / d * 100 + '%'; this.time.textContent = fmt(c) + ' / ' + fmt(d);
  }
  play() { this.want = true; this.ready && this.yt.playVideo(); }
  pause() { this.want = false; this.ready && this.yt.pauseVideo(); }
  toggle() { if (!this.ready) { this.want = true; return; } this.yt.getPlayerState() === 1 ? this.pause() : this.play(); }
  mute() {
    this.muted = true; this.ready && this.yt.mute();
    if (VideoPlayer.audible === this) VideoPlayer.audible = null;
    this.icons();
  }
  unmute() {
    if (!this.ready) { this.pendingUnmute = true; return; }
    // SINGLE AUDIO: silence whoever is audible first
    if (VideoPlayer.audible && VideoPlayer.audible !== this) VideoPlayer.audible.mute();
    VideoPlayer.audible = this; this.muted = false;
    this.yt.unMute(); this.yt.setVolume(100); store.set();
    this.play(); this.icons();
  }
  autoUnmute() {   // remembered preference; fall back to muted if the browser blocks it
    this.pendingUnmute = false;
    if (VideoPlayer.audible && VideoPlayer.audible !== this) return;
    this.unmute();
    setTimeout(() => { if (this.yt.getPlayerState() !== 1) { this.mute(); this.yt.playVideo(); } }, 700);
  }
  enter() { this.play(); if (store.get() && this.muted && !VideoPlayer.audible) this.ready ? this.autoUnmute() : this.pendingUnmute = true; }
  leave() { this.pause(); this.pendingUnmute = false; if (VideoPlayer.audible === this) this.mute(); }
}

/* ---------- boot ---------- */
const boot = () => {
  if (location.protocol === 'file:') console.warn('YouTube embeds fail on file://. Use a local server (Live Server, npx serve) or deploy.');
  $$('.player[data-yt]').forEach(el => new VideoPlayer(el));
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  /* Lenis + GSAP sync (lerp, no lagSmoothing(0)) */
  let lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
  }
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const h = a.getAttribute('href'), t = h.length > 1 && $(h); if (!t) return;
    e.preventDefault(); lenis ? lenis.scrollTo(t, { offset: -20 }) : t.scrollIntoView({ behavior: 'smooth' });
  }));

  /* hero intro + parallax */
  gsap.timeline({ defaults: { ease: 'power3.out' } })
    .from('.nav', { y: -40, opacity: 0, duration: .9 })
    .from('.chip', { y: 20, opacity: 0, duration: .7 }, '-=.55')
    .from('.hero-title .ln', { y: 60, opacity: 0, duration: 1, stagger: .09 }, '-=.35')
    .from('.sub, .hero .row', { y: 30, opacity: 0, duration: .9, stagger: .1 }, '-=.6')
    .from('.hero-reel', { scale: .96, opacity: 0, duration: 1.1 }, '-=.6');
  if (!reduced) gsap.to('.hero-title', { y: -60, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  /* pinned horizontal reels + counter */
  const rail = $('.rail'), counter = $('.counter');
  const dist = () => Math.max(0, rail.scrollWidth - innerWidth);
  if (!reduced && rail && dist() > 0) {
    gsap.to(rail, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: '.reels', pin: true, scrub: .6, start: 'top top', end: () => '+=' + dist(), invalidateOnRefresh: true,
        onUpdate: s => counter.textContent = '0' + Math.min(3, Math.floor(s.progress * 3) + 1) + ' / 03' }
    });
  }

  /* long-form reveals */
  $$('.films .player').forEach((el, i) => gsap.from(el, { opacity: 0, scale: .88, y: 80, x: i ? 100 : -100, duration: 1.2, ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' } }));
  $$('.films .sec-head, .cta-card').forEach(el => gsap.from(el, { y: 60, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } }));

  /* about: scrubbed word reveal, card, stats counting */
  const bio = $('#bio');
  if (bio && !reduced) {
    bio.innerHTML = bio.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
    gsap.to('.bio .w', { opacity: 1, stagger: .08, ease: 'none', scrollTrigger: { trigger: bio, start: 'top 80%', end: 'bottom 50%', scrub: true } });
  } else if (bio) bio.style.opacity = 1;
  gsap.from('.me', { y: 70, opacity: 0, scale: .94, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: '.about-grid', start: 'top 85%' } });
  $$('.stat').forEach((el, i) => {
    const n = $('strong', el), end = +n.dataset.n, suf = n.dataset.s || '', o = { v: 0 };
    gsap.from(el, { y: 50, opacity: 0, duration: .9, delay: i * .12, ease: 'power3.out', scrollTrigger: { trigger: '.stats', start: 'top 88%' } });
    if (reduced) return;
    n.textContent = '0' + suf;
    gsap.to(o, { v: end, duration: 1.6, ease: 'power2.out', scrollTrigger: { trigger: '.stats', start: 'top 88%' }, onUpdate: () => n.textContent = Math.round(o.v) + suf });
  });

  /* FAQ accordion */
  $$('.item').forEach(it => $('.q', it).addEventListener('click', () => {
    const was = it.classList.contains('open');
    $$('.item').forEach(x => { x.classList.remove('open'); $('.q', x).setAttribute('aria-expanded', 'false'); });
    if (!was) { it.classList.add('open'); $('.q', it).setAttribute('aria-expanded', 'true'); }
    setTimeout(() => ScrollTrigger.refresh(), 520);
  }));

  /* footer: animate the WHOLE headline (no per-letter spans, so italic is never clipped) */
  gsap.from('.footer .big', { y: 60, opacity: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: '.footer', start: 'top 85%' } });
  gsap.from('.social a', { y: 20, opacity: 0, stagger: .08, duration: .7, ease: 'power3.out', scrollTrigger: { trigger: '.social', start: 'top 92%' } });

  /* magnetic buttons (desktop only) */
  if (!reduced && matchMedia('(hover:hover) and (pointer:fine)').matches) {
    $$('.btn').forEach(b => {
      const x = gsap.quickTo(b, 'x', { duration: .5, ease: 'power3' }), y = gsap.quickTo(b, 'y', { duration: .5, ease: 'power3' });
      b.addEventListener('mousemove', e => { const r = b.getBoundingClientRect(); x((e.clientX - r.left - r.width / 2) * .18); y((e.clientY - r.top - r.height / 2) * .18); });
      b.addEventListener('mouseleave', () => { x(0); y(0); });
    });
  }

  addEventListener('load', () => ScrollTrigger.refresh());
  let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => ScrollTrigger.refresh(), 200); });
};
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
  /* ---------- Reviews with gravity (Matter.js) ---------- */
(() => {
  const box = $('#gravity'); if (!box || !window.Matter) return;
  const { Engine, Runner, Bodies, Body, Composite, Constraint, Query, Events } = Matter;
  const cards = $$('.rcard', box);
  $$('.stars', box).forEach(s =>   s.innerHTML = [0, 1, 2, 3, 4].map(i => `<i style="--f:${Math.max(0, Math.min(1, r - i)) * 100}%"></i>`).join('') + `<em>${r.toFixed(1)}</em>`;
  let engine, runner, bodies = [], drag = null, started = false, visible = false;

  const build = () => {
    if (runner) Runner.stop(runner);
    drag = null;
    engine = Engine.create({ gravity: { y: 1 } });
    const W = box.clientWidth, H = box.clientHeight, t = 200;
    Composite.add(engine.world, [
      Bodies.rectangle(W / 2, H + t / 2, W * 3, t, { isStatic: true }),   // floor
      Bodies.rectangle(-t / 2, H / 2, t, H * 6, { isStatic: true }),      // left wall
      Bodies.rectangle(W + t / 2, H / 2, t, H * 6, { isStatic: true })    // right wall
    ]);
    bodies = cards.map((el, i) => {
      const w = el.offsetWidth, h = el.offsetHeight;
      const b = Bodies.rectangle(W * (.2 + .6 * Math.random()), -h - i * h * 1.15, w, h,
        { chamfer: { radius: 22 }, restitution: .25, friction: .5, frictionAir: .012 });
     Body.setAngle(b, (Math.random() - .5) * .5);
      b.el = el; b.w = w; b.h = h; return b;
    });
    Composite.add(engine.world, bodies);
        // self-righting: a gentle torque brings every card back to upright
    Events.on(engine, 'beforeUpdate', () => bodies.forEach(b => {
      const a = Math.atan2(Math.sin(b.angle), Math.cos(b.angle));      // angle from upright, -π..π
      const held = drag && drag.bodyB === b;
      Body.setAngularVelocity(b, b.angularVelocity * .92 - a * (held ? .008 : .03));
      if (!held && Math.abs(a) < .015 && Math.abs(b.angularVelocity) < .004) {   // snap the last bit
        Body.setAngle(b, b.angle - a); Body.setAngularVelocity(b, 0);
      }
    }));
    runner = Runner.create(); runner.enabled = started && visible; Runner.run(runner, engine);
  };

  gsap.ticker.add(() => bodies.forEach(b => {
    b.el.style.transform = `translate(${b.position.x - b.w / 2}px,${b.position.y - b.h / 2}px) rotate(${b.angle}rad)`;
  }));

  /* drag and throw (pointer events: works for mouse and touch, page still scrolls elsewhere) */
  const pt = e => { const r = box.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  box.addEventListener('pointerdown', e => {
    if (!started) return;
    const p = pt(e), b = Query.point(bodies, p)[0]; if (!b) return;
    const dx = p.x - b.position.x, dy = p.y - b.position.y, c = Math.cos(-b.angle), s = Math.sin(-b.angle);
    drag = Constraint.create({ pointA: p, bodyB: b, pointB: { x: dx * c - dy * s, y: dx * s + dy * c }, stiffness: .15, damping: .12, length: 0 });
    Composite.add(engine.world, drag);
    box.setPointerCapture(e.pointerId); box.classList.add('grab'); e.preventDefault();
  });
  box.addEventListener('pointermove', e => { if (drag) drag.pointA = pt(e); });
  const drop = () => { if (!drag) return; Composite.remove(engine.world, drag); drag = null; box.classList.remove('grab'); };
  ['pointerup', 'pointercancel'].forEach(t => box.addEventListener(t, drop));

  /* shake button */
    $('#shake').addEventListener('click', () => bodies.forEach(b => {
    Body.setVelocity(b, { x: (Math.random() - .5) * 16, y: -14 - Math.random() * 10 });
    Body.setAngularVelocity(b, (Math.random() - .5) * .35);
  }));

  /* run only while visible, start falling when scrolled into view */
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (runner) runner.enabled = started && visible; }).observe(box);
  ScrollTrigger.create({ trigger: box, start: 'top 65%', once: true, onEnter: () => { started = true; runner.enabled = visible; } });
  gsap.from('.reviews .sec-head', { y: 50, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.reviews', start: 'top 85%' } });

  (document.fonts && document.fonts.ready || Promise.resolve()).then(build);   // measure after fonts load
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 300); });
})();
})();
