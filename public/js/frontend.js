// Global variables to hold data
let siteData = {
  profile: { socials: [] },
  categories: [],
  links: [],
  searchEngines: [],
  siteConfig: {},
  themeConfig: {},
  isAdmin: false
};
let selectedCategoryId = 'all';

// --- Toast Notification Helper ---
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast-banner');
  const toastMsg = document.getElementById('toast-message');
  const toastIcon = document.getElementById('toast-icon');

  toastMsg.textContent = message;
  toastIcon.textContent = type === 'success' ? '✅' : '❌';
  toast.className = `toast-notification active toast-${type}`;

  setTimeout(() => {
    toast.className = 'toast-notification';
  }, 3000);
}

// --- Live Digital Clock Widget ---
function startClock() {
  const clockElement = document.getElementById('digital-clock');
  
  function updateTime() {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    clockElement.textContent = `${hrs}:${mins}:${secs}`;
  }

  updateTime();
  setInterval(updateTime, 1000);
}

// --- Light/Dark Theme Listener ---
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else if (savedTheme === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
  }
  
  initThemeToggleListener();
}

function initThemeToggleListener() {
  const themeToggle = document.getElementById('theme-toggle-btn');
  if (themeToggle) {
    // Remove old listeners by cloning if needed, or simply re-attach
    themeToggle.onclick = () => {
      document.documentElement.classList.toggle('dark');
      const isDark = document.documentElement.classList.contains('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    };
  }
}

// --- Page View Stats API Tracker ---
function trackPageView() {
  if (!sessionStorage.getItem('nav_visited_today')) {
    fetch('/api/visit', { method: 'POST' })
      .then(res => res.json())
      .then(() => {
        sessionStorage.setItem('nav_visited_today', 'true');
      })
      .catch(err => console.error('统计PV失败:', err));
  }
}

// --- Load Site Data ---
async function fetchSiteData() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('网络请求异常');
    siteData = await res.json();
    
    applyConfigurations();
    renderHeaderControls(siteData.isAdmin);
    renderSidebarProfile();
    renderSearchEngines();
    renderCategories();
    renderLinksGrid();
  } catch (err) {
    console.error('获取导航数据失败:', err);
    showToast('无法连接后台服务器，请检查服务状态', 'error');
  }
}

// --- Render Header Controls (Dynamically shows admin option & logout) ---
function renderHeaderControls(isAdmin) {
  const container = document.querySelector('.header-controls');
  if (!container) return;

  const themeBtnHtml = `
    <button class="theme-toggle" id="theme-toggle-btn" title="切换暗黑/白天模式" aria-label="Theme toggle">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    </button>
  `;

  if (isAdmin) {
    container.innerHTML = `
      ${themeBtnHtml}
      <button class="admin-gateway-btn" onclick="location.href='admin.html'" title="进入管理控制台" style="display: flex; align-items: center; gap: 6px;">
        ⚙️ 控制台
      </button>
      <button class="admin-gateway-btn" id="frontend-logout-btn" title="退出登录" style="display: flex; align-items: center; gap: 6px; border-color: rgba(239, 68, 68, 0.35); color: #ef4444; background: rgba(239, 68, 68, 0.05);">
        🚪 退出
      </button>
    `;

    document.getElementById('frontend-logout-btn').addEventListener('click', async () => {
      if (confirm('确定要退出管理员身份吗？退出后将立即隐藏所有私密个人链接。')) {
        try {
          await fetch('/api/logout', { method: 'POST' });
          location.reload();
        } catch (err) {
          console.error(err);
          location.reload();
        }
      }
    });
  } else {
    container.innerHTML = `
      ${themeBtnHtml}
      <button class="admin-gateway-btn" onclick="location.href='login.html'" title="进入管理后台" style="display: flex; align-items: center; gap: 6px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
        后台管理
      </button>
    `;
  }

  // Re-attach listener because innerHTML wiped it
  initThemeToggleListener();
}

// --- Apply Dynamic Styles, Custom CSS, and Site Titles ---
function applyConfigurations() {
  const { siteConfig, themeConfig } = siteData;
  if (!siteConfig || !themeConfig) return;

  document.getElementById('site-page-title').textContent = siteConfig.title || '优雅导航';
  
  const logoIconEl = document.getElementById('logo-icon-el');
  const logoSubEl = document.getElementById('logo-sub-el');
  if (logoIconEl) logoIconEl.textContent = siteConfig.logoIcon || '⛵';
  if (logoSubEl) logoSubEl.textContent = siteConfig.logoSub || '优雅导航';
  
  const footerEl = document.getElementById('site-footer');
  if (footerEl) {
    footerEl.innerHTML = siteConfig.footerText || '';
  }
  
  if (siteConfig.favicon) {
    let faviconEl = document.querySelector('link[rel="icon"]');
    if (!faviconEl) {
      faviconEl = document.createElement('link');
      faviconEl.rel = 'icon';
      document.head.appendChild(faviconEl);
    }
    
    if (siteConfig.favicon.length < 5) {
      faviconEl.href = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${siteConfig.favicon}</text></svg>`;
    } else {
      faviconEl.href = siteConfig.favicon;
    }
  }

  const styleEl = document.getElementById('custom-theme-styles');
  let inlineStyles = `:root {
    --hue-primary: ${themeConfig.primaryHue || 215};
    --hue-accent: ${themeConfig.accentHue || 260};
    --glass-blur: ${themeConfig.glassBlur || 16}px;
    --glass-opacity-light: ${themeConfig.glassOpacity || 0.65};
    --glass-opacity-dark: ${(themeConfig.glassOpacity || 0.65) - 0.05};
    --border-radius: ${themeConfig.borderRadius || 20}px;
  }`;

  if (themeConfig.bgImage) {
    inlineStyles += `\nbody { --bg-image: url('${themeConfig.bgImage}'); }`;
  } else {
    inlineStyles += `\nbody { --bg-image: none; }`;
  }
  styleEl.innerHTML = inlineStyles;

  document.getElementById('admin-custom-css').innerHTML = themeConfig.customCss || '';

  if (siteConfig.scriptInjection) {
    const placeholder = document.getElementById('analytics-scripts-placeholder');
    placeholder.innerHTML = siteConfig.scriptInjection;
    
    const scripts = placeholder.querySelectorAll('script');
    scripts.forEach(oldScript => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
      newScript.appendChild(document.createTextNode(oldScript.innerHTML));
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  }
}

// --- Render Left Profile Sidebar ---
function renderSidebarProfile() {
  const { name, bio, avatar, socials } = siteData.profile;
  
  document.getElementById('logo-text').textContent = name || '导航';
  document.getElementById('sidebar-name').textContent = name || '导航';
  document.getElementById('sidebar-bio').textContent = bio || '一句话简介';
  
  const avatarEl = document.getElementById('sidebar-avatar');
  avatarEl.textContent = avatar || '⛵';

  const socialsRow = document.getElementById('sidebar-socials');
  socialsRow.innerHTML = '';

  const linksList = document.getElementById('sidebar-links-list');
  linksList.innerHTML = '';
  
  if (socials && Array.isArray(socials)) {
    socials.forEach(soc => {
      socialsRow.appendChild(createSocialBtn(soc.icon || '🔗', soc.url, soc.platform));
      linksList.appendChild(createFullLinkBtn(`${soc.icon || '🔗'} ${soc.platform}`, soc.url));
    });
  }
}

function createSocialBtn(icon, url, title) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.className = 'social-icon-btn';
  a.title = title;
  a.textContent = icon;
  return a;
}

function createFullLinkBtn(text, url) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.className = 'profile-link-btn';
  a.textContent = text;
  return a;
}

// --- Render Dynamic Search Engines ---
function renderSearchEngines() {
  const select = document.getElementById('search-engine-select');
  select.innerHTML = '';

  const engines = siteData.searchEngines || [];
  if (engines.length === 0) {
    select.innerHTML = '<option value="custom">搜索</option>';
    return;
  }

  engines.forEach(engine => {
    const opt = document.createElement('option');
    opt.value = engine.id;
    opt.textContent = engine.name;
    if (engine.isDefault) {
      opt.selected = true;
      document.getElementById('search-input').placeholder = engine.placeholder || '输入关键字搜索...';
    }
    select.appendChild(opt);
  });

  select.addEventListener('change', (e) => {
    const selectedEngine = engines.find(eng => eng.id === e.target.value);
    if (selectedEngine) {
      document.getElementById('search-input').placeholder = selectedEngine.placeholder || '输入关键字搜索...';
    }
  });
}

// --- Render Categories Tabs ---
function renderCategories() {
  const container = document.getElementById('category-tabs-container');
  container.innerHTML = `<button class="category-tab-btn ${selectedCategoryId === 'all' ? 'active' : ''}" data-category-id="all">全部</button>`;

  siteData.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `category-tab-btn ${selectedCategoryId === cat.id ? 'active' : ''}`;
    btn.setAttribute('data-category-id', cat.id);
    btn.textContent = cat.name;
    container.appendChild(btn);
  });

  container.addEventListener('click', (e) => {
    if (e.target.classList.contains('category-tab-btn')) {
      document.querySelectorAll('.category-tab-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      selectedCategoryId = e.target.getAttribute('data-category-id');
      renderLinksGrid();
    }
  });
}

// Helper: Create a single link card element
function createLinkCard(link) {
  const card = document.createElement('div');
  card.className = 'link-card';
  card.setAttribute('data-url', link.url);
  card.setAttribute('data-id', link.id);

  const categoryObj = siteData.categories.find(c => c.id === link.categoryId);
  const categoryName = categoryObj ? categoryObj.name : '未分类';

  const initial = link.title ? link.title.charAt(0) : '🔗';
  
  // Add Lock Indicator if it's a private link
  const isPrivate = link.status === 'private';
  const lockIconHtml = isPrivate 
    ? ` <span class="lock-indicator" title="仅管理员登录可见">🔒</span>`
    : '';

  // Add Uptime Kuma Status Indicator Dot if status data is available
  let kumaDotHtml = '';
  let kumaHistoryHtml = '';
  
  if (link.statusKuma !== null && link.statusKuma !== undefined) {
    const kumaStatus = typeof link.statusKuma === 'object' ? link.statusKuma.status : link.statusKuma;
    let statusClass = '';
    let statusText = '';
    
    switch (kumaStatus) {
      case 1:
        statusClass = 'status-up';
        statusText = '在线 (正常工作)';
        break;
      case 0:
        statusClass = 'status-down';
        statusText = '离线 (检测到故障)';
        break;
      case 2:
        statusClass = 'status-pending';
        statusText = '等待检测中';
        break;
      case 3:
        statusClass = 'status-maintenance';
        statusText = '维护中';
        break;
      default:
        break;
    }
    
    if (statusClass) {
      kumaDotHtml = `
        <span class="status-indicator-wrapper" title="监控状态: ${statusText}">
          <span class="kuma-dot ${statusClass}"></span>
        </span>
      `;
    }

    // Generate Uptime History Bar
    if (typeof link.statusKuma === 'object' && Array.isArray(link.statusKuma.history) && link.statusKuma.history.length > 0) {
      const historyDots = link.statusKuma.history.map(status => {
        let dotClass = '';
        let titleText = '';
        switch (status) {
          case 1:
            dotClass = 'history-dot-up';
            titleText = '在线 (UP)';
            break;
          case 0:
            dotClass = 'history-dot-down';
            titleText = '故障 (DOWN)';
            break;
          case 2:
            dotClass = 'history-dot-pending';
            titleText = '待定 (PENDING)';
            break;
          case 3:
            dotClass = 'history-dot-maintenance';
            titleText = '维护中 (MAINTENANCE)';
            break;
          default:
            dotClass = 'history-dot-unknown';
            titleText = '未知';
        }
        return `<span class="kuma-history-dot ${dotClass}" title="${titleText}"></span>`;
      }).join('');

      kumaHistoryHtml = `
        <div class="kuma-history-bar" title="最近 ${link.statusKuma.history.length} 次检测记录">
          ${historyDots}
        </div>
      `;
    }
  }

  card.innerHTML = `
    <div class="link-card-header">
      <div class="link-icon-box">${initial}</div>
      <div class="link-title-info">
        <span class="link-title" style="display: flex; align-items: center;">
          ${kumaDotHtml}
          ${link.title}
          ${lockIconHtml}
        </span>
        <span class="link-category-tag">${categoryName}</span>
      </div>
    </div>
    <p class="link-description">${link.description || '暂无描述'}</p>
    ${kumaHistoryHtml}
  `;

  card.addEventListener('click', () => {
    fetch(`/api/click/${link.id}`, { method: 'POST' })
      .catch(err => console.error('统计点击失败:', err));
    
    window.open(link.url, '_blank');
  });

  return card;
}

// --- Render Links Grid (Supports Filtering & Private tag renders) ---
function renderLinksGrid() {
  const container = document.getElementById('links-grid-container');
  container.innerHTML = '';

  if (selectedCategoryId === 'all') {
    // Group links by category
    const categoriesWithLinks = siteData.categories.map(cat => {
      const links = siteData.links.filter(l => l.categoryId === cat.id);
      return { ...cat, links };
    }).filter(cat => cat.links.length > 0);

    // Also check for any uncategorized links
    const categoryIds = siteData.categories.map(c => c.id);
    const uncategorizedLinks = siteData.links.filter(l => !l.categoryId || !categoryIds.includes(l.categoryId));
    if (uncategorizedLinks.length > 0) {
      categoriesWithLinks.push({
        id: 'uncategorized',
        name: '未分类',
        links: uncategorizedLinks
      });
    }

    if (categoriesWithLinks.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">暂无可用链接</div>`;
      return;
    }

    categoriesWithLinks.forEach(cat => {
      // Create category group container
      const groupDiv = document.createElement('div');
      groupDiv.className = 'category-group';
      
      const header = document.createElement('h2');
      header.className = 'category-section-title';
      header.textContent = cat.name;
      groupDiv.appendChild(header);

      const gridDiv = document.createElement('div');
      gridDiv.className = 'links-grid';
      
      cat.links.forEach(link => {
        const card = createLinkCard(link);
        gridDiv.appendChild(card);
      });

      groupDiv.appendChild(gridDiv);
      container.appendChild(groupDiv);
    });
  } else {
    const filteredLinks = siteData.links.filter(l => l.categoryId === selectedCategoryId);
    
    if (filteredLinks.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">此分类下暂无链接</div>`;
      return;
    }

    const gridDiv = document.createElement('div');
    gridDiv.className = 'links-grid';

    filteredLinks.forEach(link => {
      const card = createLinkCard(link);
      gridDiv.appendChild(card);
    });

    container.appendChild(gridDiv);
  }
}

// --- Search Form Submissions Forwarder ---
function performSearch() {
  const selectVal = document.getElementById('search-engine-select').value;
  const query = document.getElementById('search-input').value.trim();

  if (!query) {
    showToast('请输入要搜索的关键词', 'error');
    return;
  }

  const engine = siteData.searchEngines.find(eng => eng.id === selectVal);
  if (!engine) {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
    return;
  }

  const formattedUrl = engine.url.replace('{query}', encodeURIComponent(query));
  window.open(formattedUrl, '_blank');
}

// --- Initialize DOM Event Bindings ---
document.addEventListener('DOMContentLoaded', () => {
  startClock();
  initTheme();
  trackPageView();
  fetchSiteData();

  document.getElementById('search-submit-btn').addEventListener('click', performSearch);
  document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  });
});
