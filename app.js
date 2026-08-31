// Readers Hub - Application Script

(function () {
  'use strict';

  // Application State
  const state = {
    allArticles: [],
    filteredArticles: [],
    currentTrack: 'All',
    selectedTags: new Set(),
    searchQuery: '',
    currentPage: 1,
    pageSize: 24,
    theme: 'light'
  };

  // DOM Element References
  const elements = {
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    tryPillBtns: document.querySelectorAll('.try-pill-btn'),
    trackBtns: document.querySelectorAll('.track-btn'),
    tagsDropdownBtn: document.getElementById('tagsDropdownBtn'),
    tagsMenu: document.getElementById('tagsMenu'),
    articleCountLabel: document.getElementById('articleCountLabel'),
    pageSizeSelect: document.getElementById('pageSizeSelect'),
    articlesGrid: document.getElementById('articlesGrid'),
    emptyState: document.getElementById('emptyState'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    paginationControls: document.getElementById('paginationControls')
  };

  // --- Theme Initialization ---
  function initTheme() {
    const savedTheme = localStorage.getItem('readers_hub_theme');
    if (savedTheme) {
      state.theme = savedTheme;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      state.theme = 'dark';
    }
    document.documentElement.setAttribute('data-theme', state.theme);
  }

  function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('readers_hub_theme', state.theme);
  }

  // --- Data Loading & Normalization ---
  async function loadArticles() {
    try {
      const response = await fetch('data.json');
      if (response.ok) {
        const rawData = await response.json();
        state.allArticles = normalizeArticles(rawData);
        populateTagsMenu();
        applyFilters();
        return;
      }
    } catch (error) {
      console.warn('Fetch data.json failed (e.g. file:// protocol restriction). Falling back to window.DEFAULT_DATA:', error);
    }

    if (window.DEFAULT_DATA && (Array.isArray(window.DEFAULT_DATA) || typeof window.DEFAULT_DATA === 'object')) {
      state.allArticles = normalizeArticles(window.DEFAULT_DATA);
      populateTagsMenu();
      applyFilters();
    } else {
      renderErrorState('Failed to load articles data.');
    }
  }

  function formatArticleContent(text) {
    if (!text) return '<p>No content available for this article.</p>';

    return text
      .split('\n\n')
      .map(paragraph => {
        const cleanText = paragraph.replace(/^###\s*/, '').trim();
        if (!cleanText) return '';
        return `<p>${escapeHtml(cleanText)}</p>`;
      })
      .filter(Boolean)
      .join('');
  }

  function normalizeArticles(rawData) {
    let items = [];
    if (Array.isArray(rawData)) {
      items = rawData;
    } else if (rawData && typeof rawData === 'object') {
      if (Array.isArray(rawData.articles)) {
        items = rawData.articles;
      } else {
        items = [rawData];
      }
    }

    return items.map((item, index) => {
      let categories = [];
      if (Array.isArray(item.categories)) {
        categories = item.categories;
      } else if (typeof item.categories === 'string') {
        categories = item.categories.split(',').map(c => c.trim());
      }

      let tags = [];
      if (Array.isArray(item.tags)) {
        tags = item.tags;
      } else if (typeof item.tags === 'string') {
        tags = item.tags.split(',').map(t => t.trim());
      }

      let track = item.track || 'Engineering';
      if (categories.some(c => c.toLowerCase().includes('business'))) {
        track = 'Business';
      } else if (categories.some(c => c.toLowerCase().includes('enterprise') || c.toLowerCase().includes('supply chain'))) {
        track = 'Enterprise';
      }

      return {
        id: item.id || index + 1,
        title: item.title || item.Title || 'Untitled Article',
        categories: categories.length ? categories : ['general'],
        track: track,
        date: item.Date || item.date || item.publicationDate || '2024-08-12',
        description: item.Description || item.description || item.summary || 'No description provided.',
        content: item['total article'] || item.total_article || item.content || item.Description || '',
        tags: tags.length ? tags : ['Technology']
      };
    });
  }

  // --- Tags Menu Initialization ---
  function populateTagsMenu() {
    const allTagsSet = new Set();
    state.allArticles.forEach(art => {
      art.tags.forEach(t => allTagsSet.add(t));
    });

    elements.tagsMenu.innerHTML = '';
    allTagsSet.forEach(tag => {
      const option = document.createElement('label');
      option.className = 'tag-option-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = tag;
      checkbox.checked = state.selectedTags.has(tag);

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          state.selectedTags.add(tag);
        } else {
          state.selectedTags.delete(tag);
        }
        applyFilters();
      });

      const span = document.createElement('span');
      span.textContent = tag;

      option.appendChild(checkbox);
      option.appendChild(span);
      elements.tagsMenu.appendChild(option);
    });
  }

  // --- Filtering & Searching ---
  function applyFilters() {
    const q = state.searchQuery.toLowerCase().trim();

    state.filteredArticles = state.allArticles.filter(article => {
      // Track Filter
      if (state.currentTrack !== 'All' && article.track.toLowerCase() !== state.currentTrack.toLowerCase()) {
        return false;
      }

      // Tags Filter
      if (state.selectedTags.size > 0) {
        const hasSelectedTag = Array.from(state.selectedTags).some(selectedTag =>
          article.tags.some(t => t.toLowerCase() === selectedTag.toLowerCase())
        );
        if (!hasSelectedTag) return false;
      }

      // Search Query Filter
      if (q) {
        const titleMatch = article.title.toLowerCase().includes(q);
        const descMatch = article.description.toLowerCase().includes(q);
        const catMatch = article.categories.some(c => c.toLowerCase().includes(q));
        const tagMatch = article.tags.some(t => t.toLowerCase().includes(q));
        const trackMatch = article.track.toLowerCase().includes(q);

        return titleMatch || descMatch || catMatch || tagMatch || trackMatch;
      }

      return true;
    });

    state.currentPage = 1;
    render();
  }

  // --- Rendering UI ---
  function render() {
    renderCounter();
    renderGrid();
    renderPagination();
  }

  function renderCounter() {
    elements.articleCountLabel.textContent = `Total articles: ${state.filteredArticles.length}`;
  }

  function renderGrid() {
    const grid = elements.articlesGrid;
    grid.innerHTML = '';

    if (state.filteredArticles.length === 0) {
      elements.emptyState.hidden = false;
      return;
    }

    elements.emptyState.hidden = true;

    const start = (state.currentPage - 1) * state.pageSize;
    const end = start + state.pageSize;
    const pageArticles = state.filteredArticles.slice(start, end);

    pageArticles.forEach(article => {
      const card = createCardElement(article);
      grid.appendChild(card);
    });
  }

  function createCardElement(article) {
    const card = document.createElement('article');
    card.className = 'article-card';

    // Header top
    const cardTop = document.createElement('div');
    cardTop.className = 'card-top';

    const titleLink = document.createElement('a');
    titleLink.className = 'card-title-link';
    titleLink.href = `article.html?id=${article.id}`;

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = article.title;
    titleLink.appendChild(title);

    const date = document.createElement('span');
    date.className = 'card-date';
    date.textContent = article.date;

    cardTop.appendChild(titleLink);
    cardTop.appendChild(date);

    // Categories
    const catContainer = document.createElement('div');
    catContainer.className = 'card-categories';
    article.categories.forEach(cat => {
      const catBadge = document.createElement('span');
      const normalizedCat = cat.toLowerCase().replace(/\s+/g, '-');
      catBadge.className = `cat-badge ${normalizedCat} default`;
      catBadge.textContent = cat;
      catContainer.appendChild(catBadge);
    });

    // Description
    const desc = document.createElement('p');
    desc.className = 'card-description';
    desc.textContent = article.description;

    // Card Bottom
    const cardBottom = document.createElement('div');
    cardBottom.className = 'card-bottom';

    // Tags
    const tagContainer = document.createElement('div');
    tagContainer.className = 'card-tags';
    article.tags.forEach(tag => {
      const tagPill = document.createElement('span');
      tagPill.className = 'tag-pill';
      tagPill.innerHTML = `<span>${getTagIcon(tag)}</span> <span>${tag}</span>`;
      tagContainer.appendChild(tagPill);
    });

    // Link Button to new detail page
    const viewBtn = document.createElement('a');
    viewBtn.className = 'view-btn';
    viewBtn.href = `article.html?id=${article.id}`;
    viewBtn.innerHTML = `<span>View details</span> <span>→</span>`;

    cardBottom.appendChild(tagContainer);
    cardBottom.appendChild(viewBtn);

    // Assemble Card
    const topWrapper = document.createElement('div');
    topWrapper.appendChild(cardTop);
    topWrapper.appendChild(catContainer);
    topWrapper.appendChild(desc);

    card.appendChild(topWrapper);
    card.appendChild(cardBottom);

    return card;
  }

  function getTagIcon(tag) {
    const t = tag.toLowerCase();
    if (t.includes('ai') || t.includes('intelligence') || t.includes('learning')) return '🤖';
    if (t.includes('climate') || t.includes('agri')) return '🌿';
    if (t.includes('edtech') || t.includes('education') || t.includes('teacher') || t.includes('student') || t.includes('academic')) return '🎓';
    if (t.includes('eca')) return '🏆';
    if (t.includes('blockchain') || t.includes('crypto')) return '🔗';
    if (t.includes('logistics') || t.includes('supply')) return '📦';
    if (t.includes('iot') || t.includes('sensor')) return '📡';
    if (t.includes('health') || t.includes('bio')) return '🧬';
    if (t.includes('security') || t.includes('privacy')) return '🛡️';
    return '⚡';
  }

  // --- Pagination ---
  function renderPagination() {
    const container = elements.paginationControls;
    container.innerHTML = '';

    const totalPages = Math.ceil(state.filteredArticles.length / state.pageSize);
    if (totalPages <= 1) return;

    // Prev Button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerHTML = '‹';
    prevBtn.disabled = state.currentPage === 1;
    prevBtn.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        render();
        scrollToGridTop();
      }
    });
    container.appendChild(prevBtn);

    // Page Numbers
    for (let i = 1; i <= totalPages; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `page-btn ${i === state.currentPage ? 'active' : ''}`;
      pageBtn.textContent = i;
      pageBtn.addEventListener('click', () => {
        state.currentPage = i;
        render();
        scrollToGridTop();
      });
      container.appendChild(pageBtn);
    }

    // Next Button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerHTML = '›';
    nextBtn.disabled = state.currentPage === totalPages;
    nextBtn.addEventListener('click', () => {
      if (state.currentPage < totalPages) {
        state.currentPage++;
        render();
        scrollToGridTop();
      }
    });
    container.appendChild(nextBtn);
  }

  function scrollToGridTop() {
    elements.articlesGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderErrorState(msg) {
    elements.articlesGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon">⚠️</div>
        <h3>Failed to load articles</h3>
        <p>${escapeHtml(msg)}</p>
      </div>
    `;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // Theme Toggle
    elements.themeToggleBtn.addEventListener('click', toggleTheme);

    // Search Input
    elements.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      elements.clearSearchBtn.hidden = !state.searchQuery;
      applyFilters();
    });

    elements.clearSearchBtn.addEventListener('click', () => {
      elements.searchInput.value = '';
      state.searchQuery = '';
      elements.clearSearchBtn.hidden = true;
      applyFilters();
    });

    // Quick Try Pills
    elements.tryPillBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        elements.tryPillBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const query = btn.getAttribute('data-query');
        elements.searchInput.value = query;
        state.searchQuery = query;
        elements.clearSearchBtn.hidden = false;
        applyFilters();
      });
    });

    // Track Buttons
    elements.trackBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        elements.trackBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentTrack = btn.getAttribute('data-track');
        applyFilters();
      });
    });

    // Tags Dropdown Toggle & Auto-close logic
    elements.tagsDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = elements.tagsMenu.classList.contains('show');
      if (isOpen) {
        elements.tagsMenu.classList.remove('show');
        elements.tagsDropdownBtn.classList.remove('active');
      } else {
        elements.tagsMenu.classList.add('show');
        elements.tagsDropdownBtn.classList.add('active');
      }
    });

    document.addEventListener('click', (e) => {
      if (!elements.tagsDropdownBtn.contains(e.target) && !elements.tagsMenu.contains(e.target)) {
        elements.tagsMenu.classList.remove('show');
        elements.tagsDropdownBtn.classList.remove('active');
      }
    });

    // Page Size Select
    elements.pageSizeSelect.addEventListener('change', (e) => {
      state.pageSize = parseInt(e.target.value, 10);
      state.currentPage = 1;
      render();
    });

    // Reset Filters
    elements.resetFiltersBtn.addEventListener('click', () => {
      state.searchQuery = '';
      state.currentTrack = 'All';
      state.selectedTags.clear();
      elements.searchInput.value = '';
      elements.clearSearchBtn.hidden = true;
      elements.trackBtns.forEach(b => b.classList.remove('active'));
      elements.trackBtns[0].classList.add('active');
      elements.tryPillBtns.forEach(b => b.classList.remove('active'));
      elements.tagsMenu.classList.remove('show');
      elements.tagsDropdownBtn.classList.remove('active');
      populateTagsMenu();
      applyFilters();
    });
  }

  // --- Constellation Grid Full Webpage Canvas Background ---
  function initConstellationGrid() {
    const canvas = document.getElementById('constellationCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId;
    let width = 0;
    let height = 0;

    const mouse = {
      x: -1000,
      y: -1000,
      prevX: -1000,
      prevY: -1000,
      vx: 0,
      vy: 0,
      radius: 220,
    };

    let nodes = [];

    function handleResize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
      initNodes();
    }

    function handleMouseMove(e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }

    function handleMouseLeave() {
      mouse.x = -1000;
      mouse.y = -1000;
    }

    function initNodes() {
      nodes = [];
      const spacing = 55;
      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * spacing;
          const y = j * spacing;
          nodes.push({
            x,
            y,
            vx: 0,
            vy: 0,
            baseX: x,
            baseY: y,
            radius: Math.random() * 1.2 + 1.2,
            label: `${(i * 7).toString(16).toUpperCase()}:${(j * 11).toString(16).toUpperCase()}`,
            pulse: Math.random() * Math.PI * 2,
          });
        }
      }
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    let lastTime = performance.now();

    function render(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      mouse.vx = (mouse.x - mouse.prevX) / (dt * 1000 || 1);
      mouse.vy = (mouse.y - mouse.prevY) / (dt * 1000 || 1);
      mouse.prevX = mouse.x;
      mouse.prevY = mouse.y;

      const speed = Math.sqrt(mouse.vx * mouse.vx + mouse.vy * mouse.vy);
      const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';

      const bgColor = isDarkMode ? '#0f1015' : '#f6f8fd';
      const nodeColor = isDarkMode ? '255, 255, 255' : '15, 23, 42';
      const accentColor = '0, 109, 58';

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);

      // Node Physics Engine (Hooke's Law Spring-Mass-Damping system)
      const SPRING_K = 18;
      const DAMPING = 0.82;

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.pulse += dt * 3;

        const dx = mouse.x - n.x;
        const dy = mouse.y - n.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < mouse.radius && dist > 0) {
          const power = (1 - dist / mouse.radius);
          const force = power * (1500 + speed * 150);
          const angle = Math.atan2(dy, dx);

          n.vx -= Math.cos(angle) * force * dt;
          n.vy -= Math.sin(angle) * force * dt;
        }

        const homeDx = n.baseX - n.x;
        const homeDy = n.baseY - n.y;

        n.vx += homeDx * SPRING_K * dt;
        n.vy += homeDy * SPRING_K * dt;

        n.vx *= DAMPING;
        n.vy *= DAMPING;

        n.x += n.vx * dt * 60;
        n.y += n.vy * dt * 60;
      }

      // Draw Connections (Exact 1-to-1 like Dark Mode)
      const MAX_CONN_DIST = 75;
      const MAX_CONN_DIST_SQ = MAX_CONN_DIST * MAX_CONN_DIST;

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const ndx = n.x - n2.x;
          const ndy = n.y - n2.y;
          const distSq = ndx * ndx + ndy * ndy;

          if (distSq < MAX_CONN_DIST_SQ) {
            const nDist = Math.sqrt(distSq);
            const alpha = (1 - nDist / MAX_CONN_DIST) * (isDarkMode ? 0.18 : 0.08);

            ctx.strokeStyle = `rgba(${nodeColor}, ${alpha})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.stroke();
          }
        }
      }

      // Render Node Points & Interactive Highlights (Exact 1-to-1 like Dark Mode)
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const dx = mouse.x - n.x;
        const dy = mouse.y - n.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const isNear = dist < mouse.radius;

        const baseAlpha = isNear ? 0.95 : 0.25 + Math.sin(n.pulse) * 0.1;

        ctx.fillStyle = isNear
          ? `rgba(${accentColor}, ${baseAlpha})`
          : `rgba(${nodeColor}, ${baseAlpha})`;

        const currentRadius = isNear
          ? n.radius * 2.2
          : n.radius + Math.sin(n.pulse) * 0.3;

        ctx.beginPath();
        ctx.arc(n.x, n.y, Math.max(0.5, currentRadius), 0, Math.PI * 2);
        ctx.fill();

        if (dist < 90) {
          const pulseRing = ((n.pulse * 20) % 30) + 4;
          const ringAlpha = (1 - pulseRing / 34) * 0.4;

          ctx.strokeStyle = `rgba(${accentColor}, ${ringAlpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(n.x, n.y, pulseRing, 0, Math.PI * 2);
          ctx.stroke();

          ctx.font = '8px ui-monospace, SFMono-Regular, Consolas, monospace';
          ctx.fillStyle = `rgba(${accentColor}, 0.85)`;
          ctx.fillText(n.label, n.x + 10, n.y - 10);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    }

    animationFrameId = requestAnimationFrame(render);
  }

  // --- App Initialization ---
  function init() {
    initTheme();
    setupEventListeners();
    initConstellationGrid();
    loadArticles();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
