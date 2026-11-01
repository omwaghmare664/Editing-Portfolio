document.addEventListener('DOMContentLoaded', () => {
  // --- 1. DOM References ---
  const template = document.getElementById('workCardTemplate');
  const grid = document.getElementById('drawerContent');
  const filterRow = document.getElementById('categoryRow');
  const resetBtn = document.getElementById('drawerClose');
  const counter = document.querySelector('[data-filter-count]');
  const status = document.querySelector('[data-work-status]');
  
  const modal = document.getElementById('videoModal');
  const modalFrame = modal.querySelector('.video-modal-frame');
  const closeBtn = modal.querySelector('.video-modal-close');

  let allCards = [];

  // --- 2. Fetch Data ---
  fetch('data.json')
    .then(res => res.json())
    .then(data => {
      if (status) status.remove();
      buildFilters(data.categories);
      buildGrid(data.categories);
      setShowreel(data.categories);
      
      // Initialize GSAP animations AFTER grid is built
      if (typeof gsap !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);
        initReveals();
      }
    })
    .catch(err => {
      console.error("Error loading data:", err);
      if (status) status.textContent = "Error loading projects. Check console.";
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
        
        // YouTube Poster Image for Work Grid (maxres -> hq fallback)
        const img = node.querySelector('img');
        img.src = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        img.onerror = () => { img.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`; };
        
        // Index and Type
        node.querySelector('.work-index').textContent = `No. ${String(count).padStart(2, '0')}`;
        node.querySelector('dd[data-field="type"]').textContent = cat.name;
        
        // Title (Fetches from YouTube API in background)
        const titleEl = node.querySelector('.work-title');
        titleEl.textContent = "Loading title...";
        fetchTitle(videoId, titleEl);

        // Remove empty fields
        ['client', 'duration', 'year'].forEach(field => {
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

    filterRow.appendChild(createBtn('all', 'All Work'));
    for (const [slug, cat] of Object.entries(categories)) {
      filterRow.appendChild(createBtn(slug, cat.name));
    }
  }

  // --- 5. Filter Logic ---
  function applyFilter(activeSlug) {
    let visibleCount = 0;
    
    allCards.forEach(card => {
      const match = activeSlug === 'all' || card.dataset.category === activeSlug;
      card.hidden = !match;
      if (match) visibleCount++;
    });

    filterRow.querySelectorAll('button').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset.filter === activeSlug));
    });

    if (counter) counter.textContent = `${visibleCount} of ${allCards.length} projects`;
    if (resetBtn) resetBtn.hidden = activeSlug === 'all';
    
    if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
  }

  if (resetBtn) resetBtn.onclick = () => applyFilter('all');

  // --- 6. Fast Modal Player ---
  function openModal(videoId) {
    // Inject YouTube Player ONLY on click to save massive amounts of data
    modalFrame.innerHTML = `
      <iframe 
        src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen>
      </iframe>`;
    modal.showModal();
  }

  function closeModal() {
    modal.close();
    modalFrame.innerHTML = ''; // Crucial: Kills video and audio instantly
  }

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('close', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  document.body.addEventListener('click', (e) => {
    const link = e.target.closest('[data-lightbox="video"]');
    if (!link) return;
    const videoId = link.dataset.youtubeId;
    if (videoId) {
      e.preventDefault();
      openModal(videoId);
    }
  });

  // --- 7. Setup Showreel (Custom Thumbnail Preserved) ---
  function setShowreel(categories) {
    const firstCategory = Object.values(categories)[0];
    if (!firstCategory || !firstCategory.videos.length) return;
    
    const videoId = firstCategory.videos[0];
    const reelLink = document.querySelector('.hero-reel-link');
    const reelImg = reelLink.querySelector('img');
    
    // We ONLY update the ID. We do NOT touch reelImg.src anymore.
    reelLink.dataset.youtubeId = videoId;
    
    // Clean up the loading attributes since we are now "loaded"
    reelImg.removeAttribute('data-placeholder');
    document.getElementById('showreel').removeAttribute('data-placeholder');
  }

  // --- 8. Fetch YouTube Titles (Cached) ---
  async function fetchTitle(videoId, element) {
    const cacheKey = `yt_title_${videoId}`;
    const cachedTitle = localStorage.getItem(cacheKey);
    
    if (cachedTitle) {
      element.textContent = cachedTitle;
      return;
    }

    try {
      const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
      const data = await res.json();
      
      if (data.title) {
        element.textContent = data.title;
        localStorage.setItem(cacheKey, data.title);
      } else {
        element.textContent = "Watch Video"; 
      }
    } catch (e) {
      element.textContent = "Watch Video";
    }
  }

  // --- 9. GSAP Reveals ---
  function initReveals() {
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReduced) return;

    gsap.utils.toArray('[data-reveal="wipe"]').forEach(el => {
      gsap.fromTo(el, 
        { clipPath: "inset(0 100% 0 0)" },
        { clipPath: "inset(0 0% 0 0)", duration: 0.8, ease: "power3.out", scrollTrigger: el }
      );
    });

    gsap.utils.toArray('[data-reveal="rise"]').forEach(el => {
      gsap.fromTo(el, 
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: "power3.out", scrollTrigger: el }
      );
    });
  }
});