document.addEventListener('DOMContentLoaded', () => {
  // ── 1. DOM refs ─────────────────────────────────────────────
  const template   = document.getElementById('workCardTemplate');
  const grid       = document.getElementById('drawerContent');
  const filterRow  = document.getElementById('categoryRow');
  const resetBtn   = document.getElementById('drawerClose');
  const counter    = document.querySelector('[data-filter-count]');
  const status     = document.querySelector('[data-work-status]');

  const modal      = document.getElementById('videoModal');
  const modalFrame = modal?.querySelector('.video-modal-frame');
  const closeBtn   = modal?.querySelector('.video-modal-close');

  let allCards    = [];
  let modalPlayer = null;

  const hasGsap = typeof gsap !== 'undefined';
  const hasScrollTrigger = typeof ScrollTrigger !== 'undefined';
  if (hasGsap && hasScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  // ── 2. YouTube IFrame API (shared loader) ───────────────────
  let _ytApiPromise = null;
  function loadYTApi() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (_ytApiPromise) return _ytApiPromise;
    _ytApiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev && prev();
        resolve(window.YT);
      };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    });
    return _ytApiPromise;
  }

  // ── 3. Player CSS ───────────────────────────────────────────
  const YTP_STYLES = `
    .ytp{position:relative;width:100%;height:100%;background:#000;overflow:hidden;isolation:isolate;color:#fff;outline:none}
    .ytp-frame,.ytp-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
    .ytp-overlay{position:absolute;inset:0;z-index:2;cursor:pointer;background:transparent;transition:background .2s}

    /* Our own paused / ended overlay covers YT's native center UI entirely */
    .ytp.is-paused:not(.is-muted-cta) .ytp-overlay{background:rgba(0,0,0,.45)}
    .ytp.is-paused:not(.is-muted-cta) .ytp-overlay::after{
      content:'';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
      width:64px;height:64px;border-radius:50%;
      background:rgba(0,0,0,.6) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23fff'%3E%3Cpath d='M8 5v14l11-7z'/%3E%3C/svg%3E") center/28px no-repeat;
      border:2px solid rgba(255,255,255,.3);pointer-events:none
    }
    .ytp.is-ended .ytp-overlay{background:rgba(0,0,0,.75)}

    .ytp-controls{position:absolute;left:0;right:0;bottom:0;z-index:3;padding:22px 14px 10px;
      background:linear-gradient(transparent,rgba(0,0,0,.78));font:12px/1.4 system-ui,sans-serif;
      transition:opacity .25s,transform .25s}
    .ytp.is-playing:not(:hover):not(:focus-within):not(.is-paused) .ytp-controls{opacity:0;transform:translateY(6px);pointer-events:none}
    .ytp.is-ended .ytp-controls,.ytp.is-paused .ytp-controls{opacity:1;transform:none;pointer-events:auto}

    .ytp-timeline{position:relative;height:4px;margin-bottom:10px;background:rgba(255,255,255,.25);
      border-radius:2px;cursor:pointer;transition:height .15s}
    .ytp-timeline:hover{height:6px}
    .ytp-loaded,.ytp-progress{position:absolute;left:0;top:0;bottom:0;border-radius:2px;pointer-events:none}
    .ytp-loaded{background:rgba(255,255,255,.25);width:0}
    .ytp-progress{background:#f33;width:0}
    .ytp-seek{position:absolute;inset:0;width:100%;height:100%;opacity:0;margin:0;cursor:pointer}

    .ytp-row{display:flex;align-items:center;gap:8px}
    .ytp-row button{background:transparent;border:0;color:#fff;cursor:pointer;padding:5px;
      border-radius:5px;display:flex;align-items:center;justify-content:center}
    .ytp-row button:hover{background:rgba(255,255,255,.15)}
    .ytp-time{font-variant-numeric:tabular-nums;font-size:11px;opacity:.9;white-space:nowrap}
    .ytp-spacer{flex:1}

    .ytp-unmute{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:5;
      display:none;align-items:center;gap:10px;padding:14px 22px;border-radius:999px;
      background:rgba(0,0,0,.72);backdrop-filter:blur(12px);color:#fff;
      font:600 14px/1 system-ui,sans-serif;border:1px solid rgba(255,255,255,.3);
      cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.45);
      transition:transform .2s,background .2s}
    .ytp-unmute:hover{background:rgba(0,0,0,.9);transform:translate(-50%,-50%) scale(1.05)}
    .ytp-unmute svg{flex-shrink:0}
    .ytp.is-muted-cta .ytp-unmute{display:flex}
    .ytp.is-muted-cta .ytp-controls{opacity:0!important;pointer-events:none!important}

    .ytp-spinner{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
      width:38px;height:38px;border:3px solid rgba(255,255,255,.2);
      border-top-color:#fff;border-radius:50%;animation:ytp-spin 1s linear infinite;
      display:none;z-index:4;pointer-events:none}
    .ytp.is-buffering:not(.is-playing) .ytp-spinner{display:block}
    @keyframes ytp-spin{to{transform:translate(-50%,-50%) rotate(360deg)}}

    .ytp:focus-visible{outline:2px solid #fff;outline-offset:-4px}
  `;
  function injectYTPStyles() {
    if (document.getElementById('ytp-styles')) return;
    const s = document.createElement('style');
    s.id = 'ytp-styles';
    s.textContent = YTP_STYLES;
    document.head.appendChild(s);
  }
  injectYTPStyles();

  // ── 4. Global single-player registry ────────────────────────
  let _activePlayer = null;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && _activePlayer) _activePlayer.pause();
  });

  // ── 5. YTPlayer class ───────────────────────────────────────
  class YTPlayer {
    constructor(container, videoId, opts = {}) {
      this.container = container;
      this.videoId = videoId;
      this.opts = { autoplay: true, muted: true, loop: false, onReady: null, ...opts };
      this.player = null;
      this.destroyed = false;
      this._bufTimeout = null;
      this.state = { playing: false, ended: false, paused: false, muted: this.opts.muted, current: 0, duration: 0 };
      this._buildUI();
      this._mount();
    }

    _buildUI() {
      this.container.classList.add('ytp');
      this.container.tabIndex = 0;
      this.container.innerHTML = `
        <div class="ytp-frame"></div>
        <div class="ytp-overlay"></div>
        <div class="ytp-spinner"></div>
        <div class="ytp-controls">
          <div class="ytp-timeline">
            <div class="ytp-loaded"></div>
            <div class="ytp-progress"></div>
            <input class="ytp-seek" type="range" min="0" max="1000" value="0" step="1" aria-label="Seek">
          </div>
          <div class="ytp-row">
            <button class="ytp-play" type="button" aria-label="Play">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <span class="ytp-time">0:00 / 0:00</span>
            <span class="ytp-spacer"></span>
            <button class="ytp-mute" type="button" aria-label="Unmute">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M4 9v6h4l5 4V5L8 9Z"/>
                <path class="ytp-vol-on" d="M17 8q5 4 0 8"/>
                <path class="ytp-vol-off" d="m17 9 5 6m0-6-5 6" style="display:none"/>
              </svg>
            </button>
            <button class="ytp-full" type="button" aria-label="Fullscreen">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>
              </svg>
            </button>
          </div>
        </div>
        <button class="ytp-unmute" type="button" aria-label="Unmute and play from start">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M3 9v6h4l5 4V5L8 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.06a4.5 4.5 0 0 0 2.5-4.03zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
          <span>Click to unmute</span>
        </button>`;

      const q = (s) => this.container.querySelector(s);
      this.$ = {
        frame: q('.ytp-frame'), overlay: q('.ytp-overlay'), controls: q('.ytp-controls'),
        timeline: q('.ytp-timeline'), loaded: q('.ytp-loaded'), progress: q('.ytp-progress'),
        seek: q('.ytp-seek'), playBtn: q('.ytp-play'), muteBtn: q('.ytp-mute'),
        volOn: q('.ytp-vol-on'), volOff: q('.ytp-vol-off'),
        time: q('.ytp-time'), fullBtn: q('.ytp-full'),
        unmute: q('.ytp-unmute'),
      };
      this._bindUI();
    }

    _bindUI() {
      const $ = this.$;

      $.playBtn.addEventListener('click', () => this.toggle());

      $.unmute.addEventListener('click', (e) => {
        e.stopPropagation();
        this._unmuteAndRestart();
      });

      $.overlay.addEventListener('click', () => {
        if (this.container.classList.contains('is-muted-cta')) {
          this._unmuteAndRestart();
          return;
        }
        this.toggle();
      });

      $.muteBtn.addEventListener('click', () => this.toggleMute());
      $.fullBtn.addEventListener('click', () => this.fullscreen());

      $.seek.addEventListener('input', (e) => {
        if (!this.state.duration) return;
        const t = (e.target.value / 1000) * this.state.duration;
        this.player?.seekTo(t, true);
        this.state.current = t;
        this._updateTime();
      });

      $.timeline.addEventListener('click', (e) => {
        if (!this.state.duration) return;
        const r = $.timeline.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        const t = pct * this.state.duration;
        this.player?.seekTo(t, true);
        this.state.current = t;
        this._updateTime();
      });

      // Keyboard shortcuts
      this.container.addEventListener('keydown', (e) => {
        const tag = (e.target.tagName || '').toUpperCase();
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
        if (e.key === ' ' || e.key === 'k') { e.preventDefault(); this.toggle(); }
        else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); this.toggleMute(); }
        else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); this.fullscreen(); }
        else if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (this.player) this.player.seekTo(Math.min(this.state.duration, this.state.current + 10), true);
        }
        else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (this.player) this.player.seekTo(Math.max(0, this.state.current - 10), true);
        }
      });
    }

    async _mount() {
      await loadYTApi();
      if (this.destroyed) return;
      const id = 'ytp-' + Math.random().toString(36).slice(2, 10);
      this.$.frame.innerHTML = `<div id="${id}"></div>`;
      this.player = new YT.Player(id, {
        videoId: this.videoId,
        playerVars: {
          autoplay: this.opts.autoplay ? 1 : 0,
          mute: this.opts.muted ? 1 : 0,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          fs: 0,
          disablekb: 1,
          showinfo: 0,
          cc_load_policy: 0,
          loop: this.opts.loop ? 1 : 0,
          playlist: this.opts.loop ? this.videoId : undefined,
          origin: location.origin,
        },
        events: {
          onReady: () => this._onReady(),
          onStateChange: (e) => this._onStateChange(e),
        },
      });
    }

    _onReady() {
      if (!this.player) return;

      if (this.opts.muted) {
        this.player.mute();
        const hasUnmuted = sessionStorage.getItem('yt_unmuted') === '1';
        if (hasUnmuted) {
          setTimeout(() => {
            if (!this.player || this.destroyed) return;
            try {
              this.player.unMute();
              this.player.setVolume(100);
              this.state.muted = false;
              this.$.volOn.style.display = '';
              this.$.volOff.style.display = 'none';
              this.$.muteBtn.setAttribute('aria-label', 'Mute');
            } catch {}
          }, 400);
        } else if (this.opts.autoplay) {
          this.container.classList.add('is-muted-cta');
        }
      }

      this.state.duration = this.player.getDuration() || 0;
      this._updateTime();
      if (this.opts.autoplay) this.player.playVideo();
      this._tick = setInterval(() => this._onTick(), 200);
      this.opts.onReady?.(this);
    }

    _onTick() {
      if (!this.player || this.destroyed) return;
      try {
        const cur = this.player.getCurrentTime();
        const dur = this.player.getDuration();
        const loaded = this.player.getVideoLoadedFraction();
        if (dur > 0) {
          this.state.current = cur;
          this.state.duration = dur;
          this._updateTime();
          this.$.loaded.style.width = (loaded * 100) + '%';
        }
      } catch {}
    }

    _onStateChange(e) {
      const YT = window.YT;
      if (!YT) return;

      this.state.playing = e.data === YT.PlayerState.PLAYING;
      this.state.ended   = e.data === YT.PlayerState.ENDED;
      this.state.paused  = e.data === YT.PlayerState.PAUSED;

      // Global single-player — pause others when this plays
      if (this.state.playing) {
        if (_activePlayer && _activePlayer !== this) {
          try { _activePlayer.pause(); } catch {}
        }
        _activePlayer = this;
      }

      // Buffering spinner (debounced to avoid flicker)
      if (e.data === YT.PlayerState.BUFFERING) {
        clearTimeout(this._bufTimeout);
        this._bufTimeout = setTimeout(() => {
          if (!this.destroyed) this.container.classList.add('is-buffering');
        }, 400);
      } else {
        clearTimeout(this._bufTimeout);
        this.container.classList.remove('is-buffering');
      }

      this._updatePlayBtn();
      this.container.classList.toggle('is-playing', this.state.playing);
      this.container.classList.toggle('is-ended', this.state.ended);
      this.container.classList.toggle('is-paused', this.state.paused);
    }

    _updatePlayBtn() {
      const b = this.$.playBtn;
      const icon = this.state.ended
        ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7Z"/></svg>'
        : this.state.playing
          ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'
          : '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
      b.innerHTML = icon;
      b.setAttribute('aria-label', this.state.ended ? 'Replay' : this.state.playing ? 'Pause' : 'Play');
    }

    _updateTime() {
      const { current, duration } = this.state;
      const pct = duration ? current / duration : 0;
      this.$.progress.style.width = (pct * 100) + '%';
      this.$.seek.value = Math.round(pct * 1000);
      this.$.time.textContent = `${fmt(current)} / ${fmt(duration)}`;
    }

    play()  { this.player?.playVideo(); }
    pause() { this.player?.pauseVideo(); }

    toggle() {
      if (!this.player) return;
      if (this.state.ended) {
        this.player.seekTo(0, true);
        this.player.playVideo();
        return;
      }
      if (this.state.playing) this.player.pauseVideo();
      else this.player.playVideo();
    }

    toggleMute() {
      if (!this.player) return;
      this.state.muted = !this.state.muted;
      if (!this.state.muted) {
        try { sessionStorage.setItem('yt_unmuted', '1'); } catch {}
      }
      this.player[this.state.muted ? 'mute' : 'unMute']();
      this.$.volOn.style.display  = this.state.muted ? 'none' : '';
      this.$.volOff.style.display = this.state.muted ? '' : 'none';
      this.$.muteBtn.setAttribute('aria-label', this.state.muted ? 'Unmute' : 'Mute');
    }

    _unmuteAndRestart() {
      if (!this.player) return;
      try {
        this.player.seekTo(0, true);
        this.player.unMute();
        this.player.setVolume(100);
        this.player.playVideo();
      } catch {}
      this.state.muted = false;
      this.state.ended = false;
      try { sessionStorage.setItem('yt_unmuted', '1'); } catch {}
      this.container.classList.remove('is-muted-cta');
      this.$.volOn.style.display = '';
      this.$.volOff.style.display = 'none';
      this.$.muteBtn.setAttribute('aria-label', 'Mute');
    }

    fullscreen() {
      const el = this.container;
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      else el.requestFullscreen?.().catch(() => {});
    }

    destroy() {
      if (_activePlayer === this) _activePlayer = null;
      this.destroyed = true;
      clearInterval(this._tick);
      clearTimeout(this._bufTimeout);
      try { this.player?.destroy(); } catch {}
      this.player = null;
      this.container.innerHTML = '';
      this.container.classList.remove('ytp', 'is-playing', 'is-ended', 'is-paused', 'is-buffering', 'is-muted-cta');
    }
  }

  const fmt = (n) => {
    n = Math.max(0, Math.floor(n || 0));
    return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0');
  };

  // ── 6. Native smooth scroll for anchors ─────────────────────
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  });

  // ── 7. Fetch data ──────────────────────────────────────────
  fetch('data.json')
    .then((res) => res.json())
    .then((data) => {
      status?.remove();
      buildFilters(data.categories);
      buildGrid(data.categories);
      setupShowreel();
      applyFilter('motion');
      if (hasGsap && hasScrollTrigger) initReveals();
    })
    .catch((err) => {
      console.error('Error loading data:', err);
      if (status) status.textContent = 'Error loading projects. Check console.';
    });

  // ── 8. Grid builder ────────────────────────────────────────
  function buildGrid(categories) {
    const frag = document.createDocumentFragment();
    let count = 0;
    for (const [slug, cat] of Object.entries(categories)) {
      for (const videoId of cat.videos) {
        count++;
        const node = template.content.firstElementChild.cloneNode(true);
        node.dataset.category = slug;
        const a = node.querySelector('a');
        a.dataset.youtubeId = videoId;
        a.href = `https://youtu.be/${videoId}`;
        const img = node.querySelector('img');
        img.src = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        img.onerror = () => { img.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`; };
        node.querySelector('.work-index').textContent = `No. ${String(count).padStart(2, '0')}`;
        node.querySelector('dd[data-field="type"]').textContent = cat.name;
        const titleEl = node.querySelector('.work-title');
        titleEl.textContent = 'Loading title...';
        fetchTitle(videoId, titleEl);
        ['client', 'duration', 'year'].forEach((field) => {
          const dd = node.querySelector(`dd[data-field="${field}"]`);
          if (dd && !dd.textContent.trim()) dd.closest('div').remove();
        });
        frag.appendChild(node);
      }
    }
    grid.appendChild(frag);
    allCards = [...grid.querySelectorAll('.work-card')];
  }

  // ── 9. Filter builder ──────────────────────────────────────
  function buildFilters(categories) {
    filterRow.innerHTML = '';
    for (const [slug, cat] of Object.entries(categories)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = cat.name;
      btn.dataset.filter = slug;
      btn.setAttribute('aria-pressed', 'false');
      btn.onclick = () => applyFilter(slug);
      filterRow.appendChild(btn);
    }
  }

  // ── 10. Filter logic (debounced refresh) ───────────────────
  let _refreshT = null;
  function applyFilter(activeSlug) {
    let visibleCount = 0;
    allCards.forEach((card) => {
      const match = card.dataset.category === activeSlug;
      card.hidden = !match;
      if (match) visibleCount++;
    });
    filterRow.querySelectorAll('button').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.filter === activeSlug));
    });
    if (counter) counter.textContent = `${visibleCount} projects`;
    if (resetBtn) resetBtn.hidden = true;

    if (hasGsap) {
      const visible = allCards.filter((c) => !c.hidden);
      gsap.fromTo(visible,
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out', stagger: 0.03, overwrite: true });
    }

    if (hasScrollTrigger) {
      clearTimeout(_refreshT);
      _refreshT = setTimeout(() => ScrollTrigger.refresh(), 120);
    }
  }

  // ── 11. Modal with custom player ───────────────────────────
  function openModal(videoId) {
    if (!modal || !modalFrame) return;
    closeModal();
    const el = document.createElement('div');
    el.style.cssText = 'width:100%;height:100%;position:relative';
    modalFrame.appendChild(el);
    modalPlayer = new YTPlayer(el, videoId, { autoplay: true, muted: true, loop: false });
    modal.showModal();
  }
  function closeModal() {
    if (modal?.open) modal.close();
  }
  function cleanupModal() {
    if (modalPlayer) { modalPlayer.destroy(); modalPlayer = null; }
    if (modalFrame) modalFrame.innerHTML = '';
  }

  closeBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('close', cleanupModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  document.body.addEventListener('click', (e) => {
    const link = e.target.closest('[data-lightbox="video"]');
    if (!link) return;
    const videoId = link.dataset.youtubeId;
    if (videoId) { e.preventDefault(); openModal(videoId); }
  });

  // ── 12. Showreel — reads ID from the hero link, NOT data.json ─
  function setupShowreel() {
    const reelLink = document.querySelector('.hero-reel-link');
    if (!reelLink) return;

    const FALLBACK_ID = 'jrb40f3MnwQ';
    let videoId = reelLink.dataset.youtubeId || '';
    if (!videoId) {
      const m = (reelLink.getAttribute('href') || '').match(
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/
      );
      if (m) videoId = m[1];
    }
    if (!videoId) videoId = FALLBACK_ID;

    const poster = reelLink.querySelector('img');

    const container = document.createElement('div');
    container.className = 'hero-reel-player';
    container.style.cssText = 'position:relative;width:100%;aspect-ratio:16/9;background:#000;overflow:hidden';

    if (poster) {
      poster.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;transition:opacity .5s';
      container.appendChild(poster);
    }
    reelLink.replaceWith(container);

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || container.dataset.loaded) return;
        container.dataset.loaded = '1';

        const playerEl = document.createElement('div');
        playerEl.style.cssText = 'position:absolute;inset:0;z-index:2';
        container.appendChild(playerEl);

        new YTPlayer(playerEl, videoId, {
          autoplay: true, muted: true, loop: true,
          onReady: () => {
            if (poster) {
              setTimeout(() => { poster.style.opacity = '0'; }, 400);
              setTimeout(() => poster.remove(), 1100);
            }
          },
        });

        io.disconnect();
      });
    }, { rootMargin: '300px' });
    io.observe(container);

    document.getElementById('showreel')?.removeAttribute('data-placeholder');
  }

  // ── 13. YouTube title fetch (cached) ───────────────────────
  async function fetchTitle(videoId, element) {
    const cacheKey = `yt_title_${videoId}`;
    const cachedTitle = localStorage.getItem(cacheKey);
    if (cachedTitle) { element.textContent = cachedTitle; return; }
    try {
      const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
      const data = await res.json();
      if (data.title) {
        element.textContent = data.title;
        localStorage.setItem(cacheKey, data.title);
      } else element.textContent = 'Watch Video';
    } catch { element.textContent = 'Watch Video'; }
  }

  // ── 14. GSAP scroll reveals ────────────────────────────────
  function initReveals() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.utils.toArray('[data-reveal="wipe"]').forEach((el) => {
      gsap.fromTo(el,
        { clipPath: 'inset(0 100% 0 0)' },
        { clipPath: 'inset(0 0% 0 0)', duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 85%' } });
    });
    gsap.utils.toArray('[data-reveal="rise"]').forEach((el) => {
      gsap.fromTo(el,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 85%' } });
    });
  }
});
