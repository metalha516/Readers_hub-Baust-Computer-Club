// Readers Hub - Single Article Page Script

(function () {
  'use strict';

  let allArticles = [];
  let currentTheme = 'light';

  // --- Theme Handling ---
  function initTheme() {
    const savedTheme = localStorage.getItem('readers_hub_theme');
    if (savedTheme) {
      currentTheme = savedTheme;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      currentTheme = 'dark';
    }
    document.documentElement.setAttribute('data-theme', currentTheme);

    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        currentTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', currentTheme);
        localStorage.setItem('readers_hub_theme', currentTheme);
      });
    }
  }

  // --- Get URL Parameter ---
  function getArticleIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    return id ? parseInt(id, 10) : 1;
  }

  // --- Load Articles ---
  async function loadData() {
    try {
      const response = await fetch('data.json');
      if (response.ok) {
        const rawData = await response.json();
        allArticles = normalizeArticles(rawData);
        onDataLoaded();
        return;
      }
    } catch (err) {
      console.warn('Fetch failed, using window.DEFAULT_DATA fallback:', err);
    }

    if (window.DEFAULT_DATA) {
      allArticles = normalizeArticles(window.DEFAULT_DATA);
      onDataLoaded();
    } else {
      showError('Could not load article dataset.');
    }
  }

  function onDataLoaded() {
    renderArticle();
    populateNavAuthorsMenu();
    setupNavAuthorsDropdown();
  }

  function normalizeArticles(rawData) {
    let items = Array.isArray(rawData) ? rawData : (rawData.articles || [rawData]);
    return items.map((item, index) => {
      let categories = Array.isArray(item.categories) ? item.categories : (typeof item.categories === 'string' ? item.categories.split(',') : ['General']);
      let tags = Array.isArray(item.tags) ? item.tags : (typeof item.tags === 'string' ? item.tags.split(',') : ['Tech']);
      let track = item.track || 'Engineering';

      let author = null;
      if (item.author && typeof item.author === 'object') {
        author = {
          name: item.author.name || 'Anonymous Contributor',
          role: (item.author.role || 'faculty').toLowerCase(),
          designation: item.author.designation || '',
          department: item.author.department || item.author.dept || '',
          company: item.author.company || '',
          batch: item.author.batch || '',
          levelTerm: item.author.levelTerm || item.author.level_term || ''
        };
      } else if (typeof item.author === 'string') {
        author = {
          name: item.author,
          role: 'faculty',
          designation: 'Contributor',
          department: 'Department of CSE',
          company: '',
          batch: '',
          levelTerm: ''
        };
      } else {
        author = {
          name: 'BAUST Contributor',
          role: 'faculty',
          designation: 'Contributor',
          department: 'Department of CSE',
          company: '',
          batch: '',
          levelTerm: ''
        };
      }

      return {
        id: item.id || index + 1,
        title: item.title || item.Title || 'Untitled Article',
        categories: categories.map(c => c.trim()),
        track: track,
        date: item.Date || item.date || '2024-08-12',
        author: author,
        description: item.Description || item.description || '',
        content: item['total article'] || item.total_article || item.content || item.Description || '',
        tags: tags.map(t => t.trim())
      };
    });
  }

  // --- Render Single Article ---
  function renderArticle() {
    const targetId = getArticleIdFromURL();
    const article = allArticles.find(a => a.id === targetId) || allArticles[0];

    if (!article) {
      showError('Article not found.');
      return;
    }

    document.title = `${article.title} - Readers Hub`;

    document.getElementById('articleTrack').textContent = article.track;
    document.getElementById('articleDate').textContent = article.date;
    document.getElementById('articleTitle').textContent = article.title;

    // Render Author Details inline under Title
    renderAuthorBox(article.author);

    // Categories
    const catContainer = document.getElementById('articleCategories');
    catContainer.innerHTML = '';
    article.categories.forEach(cat => {
      const span = document.createElement('span');
      const normCat = cat.toLowerCase().replace(/\s+/g, '-');
      span.className = `cat-badge ${normCat} default`;
      span.textContent = cat;
      catContainer.appendChild(span);
    });

    // Description & Content
    document.getElementById('articleDescription').textContent = article.description;
    document.getElementById('articleBody').innerHTML = formatContent(article.content);

    // Tags
    const tagContainer = document.getElementById('articleTags');
    tagContainer.innerHTML = '';
    article.tags.forEach(tag => {
      const tagPill = document.createElement('span');
      tagPill.className = 'tag-pill';
      tagPill.innerHTML = `<span>${getTagIcon(tag)}</span> <span>${tag}</span>`;
      tagContainer.appendChild(tagPill);
    });

    // Render Related Articles
    renderRelated(article);
  }

  function renderAuthorBox(author) {
    const authorBox = document.getElementById('articleAuthorBox');
    if (!authorBox || !author) return;

    const role = (author.role || '').toLowerCase();
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
      // Faculty / General
      roleBadge = '<span class="author-role-badge faculty">Faculty</span>';
      if (author.designation) detailsParts.push(escapeHtml(author.designation));
      if (author.department) detailsParts.push(escapeHtml(author.department));
    }

    const detailsText = detailsParts.join(' • ');

    authorBox.innerHTML = `
      <div class="article-author-byline">
        <span class="byline-prefix">By</span>
        <span class="author-name-text">${escapeHtml(author.name)}</span>
        ${roleBadge}
        <span class="author-details-text">${detailsText ? '• ' + detailsText : ''}</span>
      </div>
    `;
  }

  // Populate navbar dropdown with author categories only
  function populateNavAuthorsMenu() {
    const menu = document.getElementById('navAuthorsMenu');
    if (!menu) return;

    const categories = [
      { role: null, label: 'All Authors', icon: '👥', subText: 'Show all articles' },
      { role: 'faculty', label: 'Faculty', icon: '👨‍🏫', subText: 'Teachers & Professors' },
      { role: 'alumni', label: 'Alumni', icon: '🎓', subText: 'Graduates & Industry Experts' },
      { role: 'student', label: 'Students', icon: '🧑‍🎓', subText: 'Undergraduate Writers' }
    ];

    menu.innerHTML = '';

    categories.forEach(cat => {
      const item = document.createElement('div');
      item.className = 'author-menu-item';

      const roleBadgeHTML = cat.role ? `<span class="author-role-badge ${cat.role}">${cat.label}</span>` : '';

      item.innerHTML = `
        <div class="author-menu-avatar ${cat.role ? cat.role : 'reset-avatar'}">${cat.icon}</div>
        <div class="author-menu-info">
          <div class="author-menu-name-row">
            <span class="author-menu-name">${cat.label}</span>
            ${roleBadgeHTML}
          </div>
          <div class="author-menu-sub">${cat.subText}</div>
        </div>
      `;

      item.addEventListener('click', () => {
        if (cat.role) {
          window.location.href = `index.html?authorCategory=${cat.role}`;
        } else {
          window.location.href = 'index.html';
        }
      });

      menu.appendChild(item);
    });
  }

  function setupNavAuthorsDropdown() {
    const btn = document.getElementById('navAuthorsBtn');
    const menu = document.getElementById('navAuthorsMenu');
    if (!btn || !menu) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.contains('show');
      if (isOpen) {
        menu.classList.remove('show');
        btn.classList.remove('active');
      } else {
        menu.classList.add('show');
        btn.classList.add('active');
      }
    });

    document.addEventListener('click', (e) => {
      if (!btn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('show');
        btn.classList.remove('active');
      }
    });
  }

  function formatContent(text) {
    if (!text) return '<p>No full text available.</p>';
    return text
      .split('\n\n')
      .map(p => {
        const cleanText = p.replace(/^###\s*/, '').trim();
        if (!cleanText) return '';
        return `<p>${escapeHtml(cleanText)}</p>`;
      })
      .filter(Boolean)
      .join('');
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

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Render Related Articles ---
  function renderRelated(currentArticle) {
    const grid = document.getElementById('relatedGrid');
    grid.innerHTML = '';

    const related = allArticles
      .filter(a => a.id !== currentArticle.id)
      .slice(0, 3);

    related.forEach(article => {
      const card = document.createElement('article');
      card.className = 'article-card';

      const top = document.createElement('div');
      top.className = 'card-top';

      const titleLink = document.createElement('a');
      titleLink.className = 'card-title-link';
      titleLink.href = `article.html?id=${article.id}`;
      titleLink.innerHTML = `<h3 class="card-title">${escapeHtml(article.title)}</h3>`;

      const date = document.createElement('span');
      date.className = 'card-date';
      date.textContent = article.date;

      top.appendChild(titleLink);
      top.appendChild(date);

      // Author summary byline
      const authorByline = document.createElement('div');
      authorByline.className = 'card-author-wrapper';
      authorByline.innerHTML = `
        <div class="card-author-byline">
          <span class="author-name">${escapeHtml(article.author.name)}</span>
          <span class="author-role-badge ${escapeHtml(article.author.role)}">${escapeHtml(article.author.role)}</span>
        </div>
      `;

      const cats = document.createElement('div');
      cats.className = 'card-categories';
      article.categories.forEach(cat => {
        const catBadge = document.createElement('span');
        const normCat = cat.toLowerCase().replace(/\s+/g, '-');
        catBadge.className = `cat-badge ${normCat} default`;
        catBadge.textContent = cat;
        cats.appendChild(catBadge);
      });

      const desc = document.createElement('p');
      desc.className = 'card-description';
      desc.textContent = article.description;

      const bottom = document.createElement('div');
      bottom.className = 'card-bottom';

      const viewBtn = document.createElement('a');
      viewBtn.className = 'view-btn';
      viewBtn.href = `article.html?id=${article.id}`;
      viewBtn.innerHTML = `<span>View details</span> <span>→</span>`;
      bottom.appendChild(viewBtn);

      const topWrap = document.createElement('div');
      topWrap.appendChild(top);
      topWrap.appendChild(authorByline);
      topWrap.appendChild(cats);
      topWrap.appendChild(desc);

      card.appendChild(topWrap);
      card.appendChild(bottom);

      grid.appendChild(card);
    });
  }

  function showError(msg) {
    document.getElementById('articleHeroCard').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Unable to load article</h3>
        <p>${escapeHtml(msg)}</p>
        <a href="index.html" class="reset-btn" style="text-decoration:none; display:inline-block; margin-top:16px;">Back to Readers Hub</a>
      </div>
    `;
  }

  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadData();
  });
})();
