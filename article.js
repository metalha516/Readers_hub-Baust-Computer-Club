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
        renderArticle();
        return;
      }
    } catch (err) {
      console.warn('Fetch failed, using window.DEFAULT_DATA fallback:', err);
    }

    if (window.DEFAULT_DATA) {
      allArticles = normalizeArticles(window.DEFAULT_DATA);
      renderArticle();
    } else {
      showError('Could not load article dataset.');
    }
  }

  function normalizeArticles(rawData) {
    let items = Array.isArray(rawData) ? rawData : (rawData.articles || [rawData]);
    return items.map((item, index) => {
      let categories = Array.isArray(item.categories) ? item.categories : (typeof item.categories === 'string' ? item.categories.split(',') : ['General']);
      let tags = Array.isArray(item.tags) ? item.tags : (typeof item.tags === 'string' ? item.tags.split(',') : ['Tech']);
      let track = item.track || 'Engineering';

      return {
        id: item.id || index + 1,
        title: item.title || item.Title || 'Untitled Article',
        categories: categories.map(c => c.trim()),
        track: track,
        date: item.Date || item.date || '2024-08-12',
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
    return str
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
