document.addEventListener('DOMContentLoaded', () => {
  // --- 1. DOM References ---
  const template = document.getElementById('workCardTemplate');
  const grid = document.getElementById('drawerContent');
  const filterRow = document.getElementById('categoryRow');
  const resetBtn = document.getElementById('drawerClose');
  const counter = document.querySelector('[data-filter-count]');
  const status = document.querySelector('[data-work-status]');

  const modal = document.getElementById('videoModal');
  const modalFrame = modal?.querySelector('.video-modal-frame');
  const closeBtn = modal?.querySelector('.video-modal-close');

  let allCards = [];
  let lenis = null;

  // --- 0. Smooth scroll (Lenis + GSAP ScrollTrigger) ---
  // --- 0. GSAP setup + smooth anchor scroll (native) ---
const hasGsap = typeof gsap !== 'undefined';
const hasScrollTrigger = typeof ScrollTrigger !== 'undefined';
if (hasGsap && hasScrollTrigger) gsap.registerPlugin(ScrollTrigger);

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

  // --- 2. Fetch Data ---
  fetch('data.json')
    .then((res) => res.json())
    .then((data) => {
      if (status) status.remove();
      buildFilters(data.categories);
      buildGrid(data.categories);
      setShowreel(data.categories);
      applyFilter('motion');
      if (hasGsap && hasScrollTrigger) initReveals();
    })
    .catch((err) => {
      console.error('Error loading data:', err);
      if (status) status.textContent = 'Error loading projects. Check console.';
    });

  // --- 3. Build The Grid ---
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

  // --- 4. Build Filters ---
  function buildFilters(categories) {
    filterRow.innerHTML = '';
    const createBtn = (slug, label) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.dataset.filter = slug;
      btn.setAttribute('aria-pressed', 'false');
      btn.onclick = () => applyFilter(slug);
      return btn;
    };
    for (const [slug, cat] of Object.entries(categories)) {
      filterRow.appendChild(createBtn(slug, cat.name));
    }
  }

  // --- 5. Filter Logic (+ card stagger animation) ---
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

    // Animate newly-visible cards so switching filters feels alive
    if (hasGsap) {
      const visible = allCards.filter((c) => !c.hidden);
      gsap.fromTo(
        visible,
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', stagger: 0.06, overwrite: true }
      );
    }

    if (hasScrollTrigger) ScrollTrigger.refresh();
  }

  // --- 6. Modal — work cards only ---
  function openModal(videoId) {
    if (!modal || !modalFrame) return;
    modalFrame.innerHTML = `
      <iframe
        src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen></iframe>`;
    modal.showModal();
  }

  function closeModal() {
    if (!modal || !modalFrame) return;
    modal.close();
    modalFrame.innerHTML = '';
  }

  closeBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('close', closeModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  document.body.addEventListener('click', (e) => {
    const link = e.target.closest('[data-lightbox="video"]');
    if (!link) return;
    const videoId = link.dataset.youtubeId;
    if (videoId) {
      e.preventDefault();
      openModal(videoId);
    }
  });

  // --- 7. SHOWREEL: inline autoplay, no popup ---
  function setShowreel(categories) {
    const firstCategory = Object.values(categories)[0];
    if (!firstCategory?.videos?.length) return;

    const videoId = firstCategory.videos[0];
    const reelLink = document.querySelector('.hero-reel-link');
    if (!reelLink) return;

    // Styles injected once
    if (!document.getElementById('hero-reel-styles')) {
      const style = document.createElement('style');
      style.id = 'hero-reel-styles';
      style.textContent = `
        .hero-reel-inline {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          overflow: hidden;
          background: #000;
          border-radius: inherit;
        }
        .hero-reel-inline > img,
        .hero-reel-inline > iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: 0;
        }
        .hero-reel-inline > img {
          object-fit: cover;
          z-index: 1;
          transition: opacity .6s ease;
        }
        .hero-reel-inline > iframe { z-index: 2; }
      `;
      document.head.appendChild(style);
    }

    // Replace the clickable link with an inline player container
    const inline = document.createElement('div');
    inline.className = 'hero-reel-inline';

    const poster = reelLink.querySelector('img');
    if (poster) inline.appendChild(poster);

    reelLink.replaceWith(inline);

    // Lazy-load autoplay iframe when the reel scrolls into view
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || inline.dataset.loaded) return;
        inline.dataset.loaded = '1';

        const iframe = document.createElement('iframe');
        iframe.src =
          `https://www.youtube-nocookie.com/embed/${videoId}` +
          `?autoplay=1&mute=1&loop=1&playlist=${videoId}` +
          `&controls=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3`;
        iframe.title = 'Showreel';
        iframe.allow =
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.allowFullscreen = true;
        iframe.loading = 'lazy';
        iframe.addEventListener('load', () => {
          if (poster) {
            poster.style.opacity = '0';
            setTimeout(() => poster.remove(), 700);
          }
        });
        inline.appendChild(iframe);
        observer.disconnect();
      });
    }, { rootMargin: '300px' });

    observer.observe(inline);
    document.getElementById('showreel')?.removeAttribute('data-placeholder');
  }

  // --- 8. Fetch YouTube Titles (Cached) ---
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
      } else {
        element.textContent = 'Watch Video';
      }
    } catch {
      element.textContent = 'Watch Video';
    }
  }

  // --- 9. GSAP Reveals ---
  function initReveals() {
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReduced) return;

    gsap.registerPlugin(ScrollTrigger);

    gsap.utils.toArray('[data-reveal="wipe"]').forEach((el) => {
      gsap.fromTo(el,
        { clipPath: 'inset(0 100% 0 0)' },
        {
          clipPath: 'inset(0 0% 0 0)',
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 85%' },
        }
      );
    });

    gsap.utils.toArray('[data-reveal="rise"]').forEach((el) => {
      gsap.fromTo(el,
        { y: 30, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.6, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 85%' },
        }
      );
    });
  }
});
