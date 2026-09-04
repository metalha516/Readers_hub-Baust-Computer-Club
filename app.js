// Readers Hub - Application Script

(function () {
  'use strict';

  // Application State
  const state = {
    allArticles: [],
    filteredArticles: [],
    currentTrack: 'All',
    selectedTags: new Set(),
    selectedAuthorRole: null, // 'teacher' | 'alumni' | 'student' | null
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

  // --- CSV Parser Helper ---
  const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1DosGeXz-sXt5TM-o9oZH92-ETsPEAelJ9Jw-cNS4oQU/gviz/tq?tqx=out:csv';

  function parseCSV(text) {
    const lines = [];
    let row = [];
    let inQuotes = false;
    let currentVal = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentVal += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentVal.trim());
        currentVal = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') i++;
        row.push(currentVal.trim());
        currentVal = '';
        if (row.some(cell => cell !== '')) {
          lines.push(row);
        }
        row = [];
      } else {
        currentVal += char;
      }
    }
    if (currentVal || row.length > 0) {
      row.push(currentVal.trim());
      if (row.some(cell => cell !== '')) {
        lines.push(row);
      }
    }

    if (lines.length === 0) return [];
    const headers = lines[0].map(h => h.trim());
    return lines.slice(1).map(lineRow => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = lineRow[idx] !== undefined ? lineRow[idx] : '';
      });
      return obj;
    });
  }

  // --- Data Loading & Normalization ---
  async function loadArticles() {
    // 1. Try live Google Sheet CSV URL
    try {
      const response = await fetch(GOOGLE_SHEET_CSV_URL);
      if (response.ok) {
        const text = await response.text();
        const parsed = parseCSV(text);
        if (parsed && parsed.length > 0) {
          state.allArticles = normalizeArticles(parsed);
          onDataLoaded();
          return;
        }
      }
    } catch (csvErr) {
      console.warn('Fetch live Google Sheet CSV failed, falling back to local data.json:', csvErr);
    }

    // 2. Local data.json fallback
    try {
      const response = await fetch('data.json');
      if (response.ok) {
        const rawData = await response.json();
        state.allArticles = normalizeArticles(rawData);
        onDataLoaded();
        return;
      }
    } catch (error) {
      console.warn('Fetch data.json failed. Falling back to window.DEFAULT_DATA:', error);
    }

    // 3. window.DEFAULT_DATA fallback
    if (window.DEFAULT_DATA && (Array.isArray(window.DEFAULT_DATA) || typeof window.DEFAULT_DATA === 'object')) {
      state.allArticles = normalizeArticles(window.DEFAULT_DATA);
      onDataLoaded();
    } else {
      renderErrorState('Failed to load articles data.');
    }
  }

  function onDataLoaded() {
    populateTagsMenu();
    checkUrlAuthorCategoryParam();
    updateNavAuthorCatButtons();
    applyFilters();
  }

  function checkUrlAuthorCategoryParam() {
    const params = new URLSearchParams(window.location.search);
    const categoryParam = params.get('authorCategory') || params.get('role');
    if (categoryParam) {
      const norm = categoryParam.toLowerCase();
      if (['teacher', 'faculty', 'alumni', 'student'].includes(norm)) {
        state.selectedAuthorRole = (norm === 'faculty') ? 'teacher' : norm;
      }
    }
  }

  function updateNavAuthorCatButtons() {
    const current = state.selectedAuthorRole || 'all';
    const btns = document.querySelectorAll('.author-cat-nav-btn');
    btns.forEach(btn => {
      const role = btn.getAttribute('data-role');
      if (role === current || (current === 'teacher' && role === 'faculty')) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function selectAuthorCategory(role) {
    state.selectedAuthorRole = (role === 'faculty') ? 'teacher' : role;

    // Update URL param
    const url = new URL(window.location);
    if (role) {
      url.searchParams.set('authorCategory', role);
    } else {
      url.searchParams.delete('authorCategory');
      url.searchParams.delete('role');
    }
    window.history.pushState({}, '', url);

    updateNavAuthorCatButtons();
    applyFilters();
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
      // Single Category String
      let singleCategory = 'General';
      if (item.category && typeof item.category === 'string') {
        singleCategory = item.category.trim();
      } else if (item.Category && typeof item.Category === 'string') {
        singleCategory = item.Category.trim();
      } else if (Array.isArray(item.categories) && item.categories.length > 0) {
        singleCategory = item.categories[0].trim();
      } else if (typeof item.categories === 'string') {
        singleCategory = item.categories.split(',')[0].trim();
      }

      let track = item.track || item.Track || 'Engineering';

      // Author extraction (role: teacher, alumni, or student)
      let author = null;
      if (item.author && typeof item.author === 'object') {
        let rawRole = (item.author.role || 'teacher').toLowerCase();
        if (rawRole === 'faculty') rawRole = 'teacher';
        author = {
          name: item.author.name || 'Anonymous Writer',
          role: ['teacher', 'alumni', 'student'].includes(rawRole) ? rawRole : 'teacher',
          designation: item.author.designation || '',
          department: item.author.department || item.author.dept || '',
          company: item.author.company || '',
          batch: item.author.batch || '',
          levelTerm: item.author.levelTerm || item.author.level_term || ''
        };
      } else if (item['Author Name'] || item['Author_Name']) {
        let authorName = item['Author Name'] || item['Author_Name'];
        let desig = item['Author_Designation'] || item['designation'] || '';
        let dept = item['Author_Department'] || item['department'] || '';
        let lt = item['LevelTerm'] || item['levelTerm'] || '';

        let desigLower = desig.toLowerCase();
        let nameLower = authorName.toLowerCase();
        let role = 'student';
        if (desigLower.includes('teacher') || desigLower.includes('professor') || desigLower.includes('lecturer') || desigLower.includes('faculty') || nameLower.includes('dr.')) {
          role = 'teacher';
        } else if (desigLower.includes('alumni') || desigLower.includes('engineer') || desigLower.includes('architect') || desigLower.includes('batch')) {
          role = 'alumni';
        } else if (desigLower.includes('student') || lt) {
          role = 'student';
        }

        author = {
          name: authorName,
          role: role,
          designation: desig,
          department: dept,
          company: '',
          batch: '',
          levelTerm: lt
        };
      } else if (typeof item.author === 'string') {
        author = {
          name: item.author,
          role: 'teacher',
          designation: 'Teacher',
          department: 'Department of CSE',
          company: '',
          batch: '',
          levelTerm: ''
        };
      } else {
        author = {
          name: 'BAUST Teacher',
          role: 'teacher',
          designation: 'Teacher',
          department: 'Department of CSE',
          company: '',
          batch: '',
          levelTerm: ''
        };
      }

      return {
        id: item.id || index + 1,
        title: item.title || item.Title || 'Untitled Article',
        category: singleCategory,
        track: track,
        date: item.Date || item.date || item.publicationDate || '2026-09-04',
        author: author,
        description: item.Description || item.description || item.summary || 'No description provided.',
        content: item['total article'] || item['Total article'] || item.total_article || item.content || item.Description || ''
      };
    });
  }

  // --- Tags Menu Initialization ---
  function populateTagsMenu() {
    if (!elements.tagsMenu) return;

    // Build tags dynamically from single categories & tracks
    const categoriesSet = new Set();
    state.allArticles.forEach(art => {
      if (art.category) categoriesSet.add(art.category);
    });

    elements.tagsMenu.innerHTML = '';
    categoriesSet.forEach(cat => {
      const option = document.createElement('label');
      option.className = 'tag-option-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = cat;
      checkbox.checked = state.selectedTags.has(cat);

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          state.selectedTags.add(cat);
        } else {
          state.selectedTags.delete(cat);
        }
        applyFilters();
      });

      const span = document.createElement('span');
      span.textContent = cat;

      option.appendChild(checkbox);
      option.appendChild(span);
      elements.tagsMenu.appendChild(option);
    });
  }

  // --- Filtering & Searching ---
  function applyFilters() {
    const q = state.searchQuery.toLowerCase().trim();

    state.filteredArticles = state.allArticles.filter(article => {
      // Author Role Filter (teacher, alumni, student)
      if (state.selectedAuthorRole) {
        if (article.author.role.toLowerCase() !== state.selectedAuthorRole.toLowerCase()) {
          return false;
        }
      }

      // Track Filter
      if (state.currentTrack !== 'All' && article.track.toLowerCase() !== state.currentTrack.toLowerCase()) {
        return false;
      }

      // Category Filter (via dropdown)
      if (state.selectedTags.size > 0) {
        const matchesCategory = Array.from(state.selectedTags).some(selectedCat =>
          article.category.toLowerCase() === selectedCat.toLowerCase()
        );
        if (!matchesCategory) return false;
      }

      // Search Query Filter
      if (q) {
        const titleMatch = article.title.toLowerCase().includes(q);
        const descMatch = article.description.toLowerCase().includes(q);
        const catMatch = article.category.toLowerCase().includes(q);
        const trackMatch = article.track.toLowerCase().includes(q);
        const authorNameMatch = article.author.name.toLowerCase().includes(q);
        const authorDeptMatch = article.author.department.toLowerCase().includes(q);
        const authorCompanyMatch = article.author.company.toLowerCase().includes(q);

        return titleMatch || descMatch || catMatch || trackMatch || authorNameMatch || authorDeptMatch || authorCompanyMatch;
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
    let text = `Total articles: ${state.filteredArticles.length}`;
    if (state.selectedAuthorRole) {
      const roleName = state.selectedAuthorRole.charAt(0).toUpperCase() + state.selectedAuthorRole.slice(1);
      text += ` (Author Category: "${roleName}s")`;
    }
    elements.articleCountLabel.textContent = text;
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

  // Format Author Byline (Strict Teacher, Alumni, Student badges)
  function formatAuthorBylineHTML(author) {
    if (!author) return '';
    let role = (author.role || '').toLowerCase();
    if (role === 'faculty') role = 'teacher';

    let roleBadge = '';
    let detailsParts = [];

    if (role === 'alumni') {
      roleBadge = '<span class="author-role-badge alumni">Alumni</span>';
      if (author.designation) detailsParts.push(escapeHtml(author.designation));
      if (author.company) detailsParts.push(`<strong class="company-text">${escapeHtml(author.company)}</strong>`);
      if (author.batch) detailsParts.push(`<span class="batch-text">${escapeHtml(author.batch)}</span>`);
    } else if (role === 'student') {
      roleBadge = '<span class="author-role-badge student">Student</span>';
      if (author.levelTerm) detailsParts.push(`<span class="level-term-text">${escapeHtml(author.levelTerm)}</span>`);
      if (author.department) detailsParts.push(escapeHtml(author.department));
    } else {
      // Teacher / Faculty
      roleBadge = '<span class="author-role-badge teacher">Teacher</span>';
      if (author.designation) detailsParts.push(escapeHtml(author.designation));
      if (author.department) detailsParts.push(escapeHtml(author.department));
    }

    const detailsText = detailsParts.join(' • ');

    return `
      <div class="card-author-byline">
        <span class="author-name">${escapeHtml(author.name)}</span>
        ${roleBadge}
        <span class="author-details-text">${detailsText ? '• ' + detailsText : ''}</span>
      </div>
    `;
  }

  function createCardElement(article) {
    const card = document.createElement('article');
    card.className = 'article-card';

    // Header top: Title & Date
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

    // Author details text right under title (Teacher, Alumni, or Student)
    const authorByline = document.createElement('div');
    authorByline.className = 'card-author-wrapper';
    authorByline.innerHTML = formatAuthorBylineHTML(article.author);

    // Single Category Badge (ONLY 1 CATEGORY PER TITLE)
    const catContainer = document.createElement('div');
    catContainer.className = 'card-categories';
    const catBadge = document.createElement('span');
    const normalizedCat = article.category.toLowerCase().replace(/\s+/g, '-');
    catBadge.className = `cat-badge ${normalizedCat} default`;
    catBadge.textContent = article.category;
    catContainer.appendChild(catBadge);

    // Description
    const desc = document.createElement('p');
    desc.className = 'card-description';
    desc.textContent = article.description;

    // Card Bottom (View Details button only, tags removed as requested)
    const cardBottom = document.createElement('div');
    cardBottom.className = 'card-bottom';
    cardBottom.style.justifyContent = 'flex-end'; // Align button neatly to the right

    const viewBtn = document.createElement('a');
    viewBtn.className = 'view-btn';
    viewBtn.href = `article.html?id=${article.id}`;
    viewBtn.innerHTML = `<span>View details</span> <span>→</span>`;

    cardBottom.appendChild(viewBtn);

    // Assemble Card
    const topWrapper = document.createElement('div');
    topWrapper.appendChild(cardTop);
    topWrapper.appendChild(authorByline); // Author details
    topWrapper.appendChild(catContainer); // Single category badge
    topWrapper.appendChild(desc);

    card.appendChild(topWrapper);
    card.appendChild(cardBottom);

    return card;
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
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // Theme Toggle
    if (elements.themeToggleBtn) {
      elements.themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Search Input
    if (elements.searchInput) {
      elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        elements.clearSearchBtn.hidden = !state.searchQuery;
        applyFilters();
      });
    }

    if (elements.clearSearchBtn) {
      elements.clearSearchBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        state.searchQuery = '';
        elements.clearSearchBtn.hidden = true;
        applyFilters();
      });
    }

    // Direct Author Category Navbar Buttons
    const authorCatBtns = document.querySelectorAll('.author-cat-nav-btn');
    authorCatBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const role = btn.getAttribute('data-role');
        selectAuthorCategory(role === 'all' ? null : role);
      });
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

    // Tags Dropdown Toggle
    if (elements.tagsDropdownBtn && elements.tagsMenu) {
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
    }

    // Document click to close tags menu
    document.addEventListener('click', (e) => {
      if (elements.tagsDropdownBtn && elements.tagsMenu && !elements.tagsDropdownBtn.contains(e.target) && !elements.tagsMenu.contains(e.target)) {
        elements.tagsMenu.classList.remove('show');
        elements.tagsDropdownBtn.classList.remove('active');
      }
    });

    // Page Size Select
    if (elements.pageSizeSelect) {
      elements.pageSizeSelect.addEventListener('change', (e) => {
        state.pageSize = parseInt(e.target.value, 10);
        state.currentPage = 1;
        render();
      });
    }

    // Reset Filters
    if (elements.resetFiltersBtn) {
      elements.resetFiltersBtn.addEventListener('click', () => {
        state.searchQuery = '';
        state.currentTrack = 'All';
        state.selectedAuthorRole = null;
        state.selectedTags.clear();

        const url = new URL(window.location);
        url.searchParams.delete('authorCategory');
        url.searchParams.delete('role');
        window.history.pushState({}, '', url);

        updateNavAuthorCatButtons();

        if (elements.searchInput) elements.searchInput.value = '';
        if (elements.clearSearchBtn) elements.clearSearchBtn.hidden = true;
        elements.trackBtns.forEach(b => b.classList.remove('active'));
        if (elements.trackBtns[0]) elements.trackBtns[0].classList.add('active');
        elements.tryPillBtns.forEach(b => b.classList.remove('active'));
        if (elements.tagsMenu) elements.tagsMenu.classList.remove('show');
        if (elements.tagsDropdownBtn) elements.tagsDropdownBtn.classList.remove('active');

        populateTagsMenu();
        applyFilters();
      });
    }
  }

  // --- Constellation Grid Canvas Background ---
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
