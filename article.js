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

  // --- Load Articles ---
  async function loadData() {
    // 1. Try live Google Sheet CSV
    try {
      const response = await fetch(GOOGLE_SHEET_CSV_URL);
      if (response.ok) {
        const text = await response.text();
        const parsed = parseCSV(text);
        if (parsed && parsed.length > 0) {
          allArticles = normalizeArticles(parsed);
          renderArticle();
          return;
        }
      }
    } catch (csvErr) {
      console.warn('Fetch Google Sheet CSV failed, using local data.json:', csvErr);
    }

    // 2. Local data.json fallback
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

    // 3. window.DEFAULT_DATA fallback
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
        date: item.Date || item.date || '2026-09-04',
        author: author,
        description: item.Description || item.description || '',
        content: item['total article'] || item['Total article'] || item.total_article || item.content || item.Description || ''
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

    // Single Category Badge (ONLY 1 CATEGORY PER TITLE)
    const catContainer = document.getElementById('articleCategories');
    catContainer.innerHTML = '';
    const span = document.createElement('span');
    const normCat = article.category.toLowerCase().replace(/\s+/g, '-');
    span.className = `cat-badge ${normCat} default`;
    span.textContent = article.category;
    catContainer.appendChild(span);

    // Description & Content
    document.getElementById('articleDescription').textContent = article.description;
    document.getElementById('articleBody').innerHTML = formatContent(article.content);

    // Tags section (empty/hidden)
    const tagContainer = document.getElementById('articleTags');
    if (tagContainer) {
      tagContainer.innerHTML = '';
      tagContainer.style.display = 'none';
    }

    // Render Related Articles
    renderRelated(article);
  }

  function renderAuthorBox(author) {
    const authorBox = document.getElementById('articleAuthorBox');
    if (!authorBox || !author) return;

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

    authorBox.innerHTML = `
      <div class="article-author-byline">
        <span class="byline-prefix">By</span>
        <span class="author-name-text">${escapeHtml(author.name)}</span>
        ${roleBadge}
        <span class="author-details-text">${detailsText ? '• ' + detailsText : ''}</span>
      </div>
    `;
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
      let roleName = article.author.role === 'faculty' ? 'teacher' : article.author.role;
      const authorByline = document.createElement('div');
      authorByline.className = 'card-author-wrapper';
      authorByline.innerHTML = `
        <div class="card-author-byline">
          <span class="author-name">${escapeHtml(article.author.name)}</span>
          <span class="author-role-badge ${escapeHtml(roleName)}">${escapeHtml(roleName.toUpperCase())}</span>
        </div>
      `;

      // Single Category Badge
      const cats = document.createElement('div');
      cats.className = 'card-categories';
      const catBadge = document.createElement('span');
      const normCat = article.category.toLowerCase().replace(/\s+/g, '-');
      catBadge.className = `cat-badge ${normCat} default`;
      catBadge.textContent = article.category;
      cats.appendChild(catBadge);

      const desc = document.createElement('p');
      desc.className = 'card-description';
      desc.textContent = article.description;

      const bottom = document.createElement('div');
      bottom.className = 'card-bottom';
      bottom.style.justifyContent = 'flex-end';

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
