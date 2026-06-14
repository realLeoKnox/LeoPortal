// Global Administrative Datasets
let adminData = {
  profile: { socials: [] },
  categories: [],
  links: [],
  searchEngines: [],
  siteConfig: {},
  themeConfig: {},
  analytics: { views: [] }
};

// Helper: HTTP API Headers builder (HTTP-Only cookies are sent automatically by the browser)
function getAuthHeaders() {
  return {
    'Content-Type': 'application/json'
  };
}

// --- Toast Notification Banner ---
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

// --- Modal Controller ---
function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

// --- Apply Dynamic Theme Configurations ---
function applyThemePreview(config) {
  const styleEl = document.getElementById('custom-theme-styles');
  let inlineStyles = `:root {
    --hue-primary: ${config.primaryHue || 215};
    --hue-accent: ${config.accentHue || 260};
    --glass-blur: ${config.glassBlur || 16}px;
    --glass-opacity-light: ${config.glassOpacity || 0.65};
    --glass-opacity-dark: ${(config.glassOpacity || 0.65) - 0.05};
    --border-radius: ${config.borderRadius || 20}px;
  }`;

  if (config.bgImage) {
    inlineStyles += `\nbody { --bg-image: url('${config.bgImage}'); }`;
  } else {
    inlineStyles += `\nbody { --bg-image: none; }`;
  }
  styleEl.innerHTML = inlineStyles;
}

// --- Fetch Admin System Data ---
async function fetchAdminData() {
  try {
    const res = await fetch('/api/admin/data', {
      headers: getAuthHeaders()
    });

    if (res.status === 401) {
      // Unauthorized: cookie is invalid or missing, redirect to login
      location.href = 'login.html';
      return;
    }

    if (!res.ok) throw new Error('读取数据失败');

    adminData = await res.json();

    // Redraw all UI elements
    applyThemePreview(adminData.themeConfig);
    updateStatsWidgets();
    renderDashboardHotLinks();
    renderLinksTable();
    renderCategoriesTable();
    renderEnginesTable();
    
    // Config forms
    populateProfileForm();
    populateFormSelectDropdowns();
    populateThemeForm();
    populateSiteConfigForm();
    populateKumaForm();
    
    // Draw canvas analytics charts
    initViewsChart();

    // Authorization success: Display hidden page body (avoids flash of unauthenticated layout)
    document.body.style.display = 'block';

  } catch (err) {
    console.error(err);
    showToast('无法从后端加载管理数据', 'error');
    // Redirect if it's a connection auth failure
    setTimeout(() => {
      location.href = 'login.html';
    }, 1500);
  }
}

// --- Update Statistics Dashboard Widget ---
function updateStatsWidgets() {
  document.getElementById('stat-total-links').textContent = adminData.links.length;
  document.getElementById('stat-total-categories').textContent = adminData.categories.length;
  
  const todayStr = new Date().toISOString().split('T')[0].substring(5);
  const todayRecord = adminData.analytics.views.find(v => v.date === todayStr);
  document.getElementById('stat-today-views').textContent = todayRecord ? todayRecord.count : 0;

  const totalClicks = adminData.links.reduce((sum, link) => sum + (link.clicks || 0), 0);
  document.getElementById('stat-total-clicks').textContent = totalClicks;
}

// --- Render Dashboard Hot Rank list ---
function renderDashboardHotLinks() {
  const tbody = document.getElementById('top-links-tbody');
  tbody.innerHTML = '';

  const hotLinks = [...adminData.links]
    .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
    .slice(0, 5);

  if (hotLinks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">暂无点击量统计数据</td></tr>`;
    return;
  }

  hotLinks.forEach(link => {
    const cat = adminData.categories.find(c => c.id === link.categoryId);
    const catName = cat ? cat.name : '未分类';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 600;">${link.title}</td>
      <td><span class="badge" style="background: var(--primary-light); color: var(--primary);">${catName}</span></td>
      <td style="font-family: monospace; font-size: 12px; color: var(--text-muted);">${link.url}</td>
      <td style="font-weight: 700; color: var(--primary);">${link.clicks || 0} 次</td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Render Links Table ---
let currentLinkFilter = 'all';
function renderLinksTable() {
  const tbody = document.getElementById('links-tbody');
  tbody.innerHTML = '';

  const filtered = currentLinkFilter === 'all' 
    ? adminData.links 
    : adminData.links.filter(l => l.categoryId === currentLinkFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">暂无链接，点击上方按钮新增</td></tr>`;
    return;
  }

  filtered.forEach(link => {
    const cat = adminData.categories.find(c => c.id === link.categoryId);
    const catName = cat ? cat.name : '未分类';
    
    let statusBadgeHtml = '';
    if (link.status === 'public') {
      statusBadgeHtml = '<span class="badge badge-success">公开</span>';
    } else if (link.status === 'private') {
      statusBadgeHtml = '<span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #8b5cf6;">私密 (登录可见)</span>';
    } else {
      statusBadgeHtml = '<span class="badge badge-danger">隐藏</span>';
    }
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 600;">${link.title}</td>
      <td><span class="badge" style="background: var(--primary-light); color: var(--primary);">${catName}</span></td>
      <td style="font-family: monospace; font-size: 12px; color: var(--text-muted); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${link.url}</td>
      <td style="font-weight: 700;">${link.clicks || 0}</td>
      <td>${statusBadgeHtml}</td>
      <td>
        <div class="table-action-btns">
          <button class="icon-action-btn" onclick="editLink('${link.id}')">✏️</button>
          <button class="icon-action-btn delete" onclick="deleteLink('${link.id}')">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Render Categories Table ---
function renderCategoriesTable() {
  const tbody = document.getElementById('categories-tbody');
  tbody.innerHTML = '';

  const sortedCategories = [...adminData.categories].sort((a, b) => a.sortOrder - b.sortOrder);

  if (sortedCategories.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">暂无分类，点击上方按钮新增</td></tr>`;
    return;
  }

  sortedCategories.forEach(cat => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 600;">${cat.name}</td>
      <td>排序权重: <strong style="color: var(--primary);">${cat.sortOrder || 1}</strong></td>
      <td>
        <div class="table-action-btns">
          <button class="icon-action-btn" onclick="editCategory('${cat.id}')">✏️</button>
          <button class="icon-action-btn delete" onclick="deleteCategory('${cat.id}')">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Render Extensible Search Engines Table ---
function renderEnginesTable() {
  const tbody = document.getElementById('engines-tbody');
  tbody.innerHTML = '';

  const sortedEngines = [...(adminData.searchEngines || [])].sort((a, b) => a.sortOrder - b.sortOrder);

  if (sortedEngines.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">暂无配置搜索引擎</td></tr>`;
    return;
  }

  sortedEngines.forEach(eng => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 700;">${eng.name}</td>
      <td style="font-family: monospace; font-size: 11px; color: var(--text-muted); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${eng.url}</td>
      <td style="font-size: 12px;">${eng.placeholder}</td>
      <td>${eng.sortOrder || 1}</td>
      <td>
        <input type="radio" name="default-engine-radio" ${eng.isDefault ? 'checked' : ''} onclick="setDefaultSearchEngine('${eng.id}')" style="cursor: pointer;">
      </td>
      <td>
        <div class="table-action-btns">
          <button class="icon-action-btn" onclick="editSearchEngine('${eng.id}')">✏️</button>
          <button class="icon-action-btn delete" onclick="deleteSearchEngine('${eng.id}')">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Toggle Default Search Engine ---
function setDefaultSearchEngine(id) {
  adminData.searchEngines.forEach(eng => {
    eng.isDefault = (eng.id === id);
  });
  pushDataUpdate();
}

// --- Populate dropdown selection ---
function populateFormSelectDropdowns() {
  const filterSelect = document.getElementById('link-filter-select');
  const formCategorySelect = document.getElementById('link-form-category');
  
  filterSelect.innerHTML = '<option value="all">全部分类</option>';
  formCategorySelect.innerHTML = '';

  adminData.categories.forEach(cat => {
    const optFilter = document.createElement('option');
    optFilter.value = cat.id;
    optFilter.textContent = cat.name;
    optFilter.selected = currentLinkFilter === cat.id;
    filterSelect.appendChild(optFilter);

    const optForm = document.createElement('option');
    optForm.value = cat.id;
    optForm.textContent = cat.name;
    formCategorySelect.appendChild(optForm);
  });
}

// --- Profile Details Form Load ---
function populateProfileForm() {
  const { name, bio, avatar, socials } = adminData.profile;
  document.getElementById('profile-name').value = name || '';
  document.getElementById('profile-avatar').value = avatar || '⛵';
  document.getElementById('profile-bio').value = bio || '';
  
  renderSocialsEditorList(socials || []);
}

// --- Customizable Socials Editor List Rendering ---
function renderSocialsEditorList(socials) {
  const container = document.getElementById('socials-editor-list');
  container.innerHTML = '';

  if (socials.length === 0) {
    container.innerHTML = `<div style="text-align: center; font-size: 13px; color: var(--text-muted); padding: 12px 0;">无自定义社交链接，点击右上角新增。</div>`;
    return;
  }

  socials.forEach((soc, idx) => {
    const row = document.createElement('div');
    row.className = 'extensible-item';
    row.innerHTML = `
      <input type="text" class="form-input social-row-platform" placeholder="平台名 (如: GitHub)" value="${soc.platform || ''}" style="flex: 2; padding: 8px 12px; font-size: 13px;" required>
      <input type="text" class="form-input social-row-icon" placeholder="图标 (Emoji 如: 🐙)" value="${soc.icon || '🔗'}" style="flex: 1; padding: 8px 12px; font-size: 13px; text-align: center;" required>
      <input type="text" class="form-input social-row-url" placeholder="跳转链接 URL" value="${soc.url || ''}" style="flex: 4; padding: 8px 12px; font-size: 13px;" required>
      <button type="button" class="icon-action-btn delete" onclick="deleteSocialRow(${idx})" style="height: 36px; width: 36px;">🗑️</button>
    `;
    container.appendChild(row);
  });
}

// Add empty social row
document.getElementById('add-social-row-btn').addEventListener('click', () => {
  const socials = gatherSocialsData();
  socials.push({ platform: '', icon: '🔗', url: '' });
  renderSocialsEditorList(socials);
});

function deleteSocialRow(index) {
  const socials = gatherSocialsData();
  socials.splice(index, 1);
  renderSocialsEditorList(socials);
}

function gatherSocialsData() {
  const list = [];
  const rows = document.querySelectorAll('#socials-editor-list .extensible-item');
  rows.forEach(row => {
    const platform = row.querySelector('.social-row-platform').value.trim();
    const icon = row.querySelector('.social-row-icon').value.trim();
    const url = row.querySelector('.social-row-url').value.trim();
    if (platform) {
      list.push({ platform, icon, url });
    }
  });
  return list;
}

// --- Load Visual Customization values into Forms ---
function populateThemeForm() {
  const tc = adminData.themeConfig || {};
  
  document.getElementById('slider-primary-hue').value = tc.primaryHue || 215;
  document.getElementById('val-primary-hue').textContent = `${tc.primaryHue || 215}°`;
  
  document.getElementById('slider-accent-hue').value = tc.accentHue || 260;
  document.getElementById('val-accent-hue').textContent = `${tc.accentHue || 260}°`;
  
  document.getElementById('slider-glass-blur').value = tc.glassBlur || 16;
  document.getElementById('val-glass-blur').textContent = `${tc.glassBlur || 16}px`;
  
  document.getElementById('slider-glass-opacity').value = tc.glassOpacity || 0.65;
  document.getElementById('val-glass-opacity').textContent = tc.glassOpacity || 0.65;
  
  document.getElementById('slider-border-radius').value = tc.borderRadius || 20;
  document.getElementById('val-border-radius').textContent = `${tc.borderRadius || 20}px`;

  document.getElementById('theme-bg-image').value = tc.bgImage || '';
  document.getElementById('theme-custom-css').value = tc.customCss || '';
}

// --- Load Site Configuration values into Forms ---
function populateSiteConfigForm() {
  const sc = adminData.siteConfig || {};
  document.getElementById('site-title').value = sc.title || '优雅导航';
  document.getElementById('site-favicon').value = sc.favicon || '⛵';
  document.getElementById('site-logo-icon').value = sc.logoIcon || '⛵';
  document.getElementById('site-logo-sub').value = sc.logoSub || '优雅导航';
  document.getElementById('site-footer').value = sc.footerText || '';
  document.getElementById('site-scripts').value = sc.scriptInjection || '';

  // Update admin sidebar UI immediately
  const adminLogoIcon = document.getElementById('admin-logo-icon-el');
  const adminLogoSub = document.getElementById('admin-logo-sub-el');
  if (adminLogoIcon) adminLogoIcon.textContent = sc.logoIcon || '⛵';
  if (adminLogoSub) adminLogoSub.textContent = `${sc.logoSub || '优雅导航'}后台`;
}

// --- Save Site Configuration ---
async function saveSiteConfig(e) {
  e.preventDefault();
  
  // Initialize siteConfig object if somehow undefined
  if (!adminData.siteConfig) adminData.siteConfig = {};
  
  adminData.siteConfig.title = document.getElementById('site-title').value.trim();
  adminData.siteConfig.favicon = document.getElementById('site-favicon').value.trim();
  adminData.siteConfig.logoIcon = document.getElementById('site-logo-icon').value.trim();
  adminData.siteConfig.logoSub = document.getElementById('site-logo-sub').value.trim();
  adminData.siteConfig.footerText = document.getElementById('site-footer').value.trim();
  adminData.siteConfig.scriptInjection = document.getElementById('site-scripts').value.trim();
  
  // Update admin sidebar UI immediately
  const adminLogoIcon = document.getElementById('admin-logo-icon-el');
  const adminLogoSub = document.getElementById('admin-logo-sub-el');
  if (adminLogoIcon) adminLogoIcon.textContent = adminData.siteConfig.logoIcon;
  if (adminLogoSub) adminLogoSub.textContent = `${adminData.siteConfig.logoSub}后台`;

  pushDataUpdate();
}

// --- Load Uptime Kuma Config into Forms ---
function populateKumaForm() {
  const sc = adminData.siteConfig || {};
  document.getElementById('kuma-enabled').checked = !!sc.kumaEnabled;
  document.getElementById('kuma-url').value = sc.kumaUrl || '';
  document.getElementById('kuma-slug').value = sc.kumaSlug || 'default';
  document.getElementById('kuma-interval').value = sc.kumaInterval || 60;
}

// --- Save Uptime Kuma Config ---
async function saveKumaConfig(e) {
  e.preventDefault();
  
  if (!adminData.siteConfig) adminData.siteConfig = {};
  
  adminData.siteConfig.kumaEnabled = document.getElementById('kuma-enabled').checked;
  adminData.siteConfig.kumaUrl = document.getElementById('kuma-url').value.trim();
  adminData.siteConfig.kumaSlug = document.getElementById('kuma-slug').value.trim();
  adminData.siteConfig.kumaInterval = parseInt(document.getElementById('kuma-interval').value) || 60;
  
  pushDataUpdate();
}

// --- Save Visual Theme Settings ---
async function saveThemeSettings(e) {
  e.preventDefault();
  adminData.themeConfig = {
    primaryHue: parseInt(document.getElementById('slider-primary-hue').value),
    accentHue: parseInt(document.getElementById('slider-accent-hue').value),
    glassBlur: parseInt(document.getElementById('slider-glass-blur').value),
    glassOpacity: parseFloat(document.getElementById('slider-glass-opacity').value),
    borderRadius: parseInt(document.getElementById('slider-border-radius').value),
    bgImage: document.getElementById('theme-bg-image').value.trim(),
    customCss: document.getElementById('theme-custom-css').value.trim()
  };
  pushDataUpdate();
}

// Live drag sliders preview handlers
function attachSlidersLivePreview() {
  const sliders = [
    { id: 'slider-primary-hue', valId: 'val-primary-hue', prop: 'primaryHue', unit: '°' },
    { id: 'slider-accent-hue', valId: 'val-accent-hue', prop: 'accentHue', unit: '°' },
    { id: 'slider-glass-blur', valId: 'val-glass-blur', prop: 'glassBlur', unit: 'px' },
    { id: 'slider-glass-opacity', valId: 'val-glass-opacity', prop: 'glassOpacity', unit: '' },
    { id: 'slider-border-radius', valId: 'val-border-radius', prop: 'borderRadius', unit: 'px' }
  ];

  sliders.forEach(slider => {
    const input = document.getElementById(slider.id);
    const label = document.getElementById(slider.valId);

    input.addEventListener('input', (e) => {
      let val = e.target.value;
      label.textContent = `${val}${slider.unit}`;

      const liveConfig = {
        primaryHue: parseInt(document.getElementById('slider-primary-hue').value),
        accentHue: parseInt(document.getElementById('slider-accent-hue').value),
        glassBlur: parseInt(document.getElementById('slider-glass-blur').value),
        glassOpacity: parseFloat(document.getElementById('slider-glass-opacity').value),
        borderRadius: parseInt(document.getElementById('slider-border-radius').value),
        bgImage: document.getElementById('theme-bg-image').value.trim()
      };
      applyThemePreview(liveConfig);
    });
  });

  document.getElementById('theme-bg-image').addEventListener('change', (e) => {
    const liveConfig = {
      primaryHue: parseInt(document.getElementById('slider-primary-hue').value),
      accentHue: parseInt(document.getElementById('slider-accent-hue').value),
      glassBlur: parseInt(document.getElementById('slider-glass-blur').value),
      glassOpacity: parseFloat(document.getElementById('slider-glass-opacity').value),
      borderRadius: parseInt(document.getElementById('slider-border-radius').value),
      bgImage: e.target.value.trim()
    };
    applyThemePreview(liveConfig);
  });
}

// --- Export Configuration Backup ---
async function exportDataBackup() {
  try {
    const res = await fetch('/api/admin/backup', {
      headers: getAuthHeaders()
    });

    if (!res.ok) throw new Error();

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'elegant_nav_db_backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('备份数据包下载成功！');
  } catch (err) {
    console.error(err);
    showToast('数据导出备份失败，请检查网络', 'error');
  }
}

// --- Import/Restore Configuration Backup ---
async function importDataBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(event) {
    try {
      const backupData = JSON.parse(event.target.result);
      
      if (!backupData.links || !backupData.categories) {
        showToast('备份数据解析错误，缺少基础键名', 'error');
        return;
      }

      if (confirm('⚠️ 确定要从本地数据包恢复配置吗？\n这会完全覆盖目前的导航数据、分类和主题配置！此操作无法撤销。')) {
        const res = await fetch('/api/admin/restore', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(backupData)
        });

        if (res.ok) {
          showToast('系统配置还原恢复成功！');
          fetchAdminData();
        } else {
          showToast('恢复配置包被服务端拒绝', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      showToast('无效的 JSON 数据格式', 'error');
    } finally {
      e.target.value = '';
    }
  };
  reader.readAsText(file);
}

// --- Send Update Request to Backend API ---
async function pushDataUpdate() {
  try {
    const res = await fetch('/api/admin/update', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        profile: adminData.profile,
        categories: adminData.categories,
        links: adminData.links,
        searchEngines: adminData.searchEngines,
        siteConfig: adminData.siteConfig,
        themeConfig: adminData.themeConfig
      })
    });

    if (!res.ok) throw new Error('数据更新失败');
    
    showToast('修改成功，已同步至数据库');
    updateStatsWidgets();
    renderDashboardHotLinks();
    renderLinksTable();
    renderCategoriesTable();
    renderEnginesTable();
    populateFormSelectDropdowns();
  } catch (err) {
    console.error(err);
    showToast('保存数据到后台失败，请重试', 'error');
  }
}

// --- SEARCH ENGINE CRUD CONTROLLER ---

document.getElementById('add-engine-btn').addEventListener('click', () => {
  document.getElementById('engine-form-action-mode').value = 'create';
  document.getElementById('engine-form-id').value = '';
  document.getElementById('engine-form-id').disabled = false;
  document.getElementById('engine-form').reset();
  document.getElementById('modal-engine-title').textContent = '新增搜索引擎';
  openModal('modal-engine');
});

function editSearchEngine(id) {
  const eng = adminData.searchEngines.find(e => e.id === id);
  if (!eng) return;

  document.getElementById('engine-form-action-mode').value = 'update';
  document.getElementById('engine-form-id').value = eng.id;
  document.getElementById('engine-form-id').disabled = true;
  document.getElementById('engine-form-name').value = eng.name;
  document.getElementById('engine-form-url').value = eng.url;
  document.getElementById('engine-form-placeholder').value = eng.placeholder;
  document.getElementById('engine-form-order').value = eng.sortOrder || 1;

  document.getElementById('modal-engine-title').textContent = '修改搜索引擎';
  openModal('modal-engine');
}

// ... rest of search engine operations remain correct ...
function submitEngineForm(e) {
  e.preventDefault();
  const mode = document.getElementById('engine-form-action-mode').value;
  const id = document.getElementById('engine-form-id').value.trim().toLowerCase();
  const name = document.getElementById('engine-form-name').value.trim();
  const url = document.getElementById('engine-form-url').value.trim();
  const placeholder = document.getElementById('engine-form-placeholder').value.trim();
  const sortOrder = parseInt(document.getElementById('engine-form-order').value) || 1;

  if (mode === 'create') {
    if (adminData.searchEngines.some(eng => eng.id === id)) {
      showToast('该 ID 键名已存在，请使用其他名称', 'error');
      return;
    }

    const newEngine = {
      id,
      name,
      url,
      placeholder,
      sortOrder,
      isDefault: adminData.searchEngines.length === 0
    };
    adminData.searchEngines.push(newEngine);
  } else {
    const idx = adminData.searchEngines.findIndex(eng => eng.id === id);
    if (idx !== -1) {
      const isDef = adminData.searchEngines[idx].isDefault;
      adminData.searchEngines[idx] = { id, name, url, placeholder, sortOrder, isDefault: isDef };
    }
  }

  closeModal('modal-engine');
  pushDataUpdate();
}

function deleteSearchEngine(id) {
  const eng = adminData.searchEngines.find(e => e.id === id);
  if (!eng) return;

  if (eng.isDefault) {
    showToast('该搜索引擎为前台默认搜索引擎，不能直接删除！请先将其他引擎设为默认。', 'error');
    return;
  }

  if (confirm(`确定要彻底删除 [${eng.name}] 搜索引擎吗？`)) {
    adminData.searchEngines = adminData.searchEngines.filter(e => e.id !== id);
    pushDataUpdate();
  }
}

// --- LINKS CRUD OPERATIONS ---

document.getElementById('add-link-btn').addEventListener('click', () => {
  document.getElementById('link-id').value = '';
  document.getElementById('link-form').reset();
  document.getElementById('modal-link-title').textContent = '新增链接';
  openModal('modal-link');
});

function editLink(id) {
  const link = adminData.links.find(l => l.id === id);
  if (!link) return;

  document.getElementById('link-id').value = link.id;
  document.getElementById('link-form-title').value = link.title;
  document.getElementById('link-form-url').value = link.url;
  document.getElementById('link-form-category').value = link.categoryId;
  document.getElementById('link-form-status').value = link.status;
  document.getElementById('link-form-desc').value = link.description || '';
  document.getElementById('link-form-kuma-monitor').value = link.kumaMonitor || '';
  
  document.getElementById('modal-link-title').textContent = '修改链接';
  openModal('modal-link');
}

function submitLinkForm(e) {
  e.preventDefault();
  const id = document.getElementById('link-id').value;
  const title = document.getElementById('link-form-title').value.trim();
  const url = document.getElementById('link-form-url').value.trim();
  const categoryId = document.getElementById('link-form-category').value;
  const status = document.getElementById('link-form-status').value;
  const description = document.getElementById('link-form-desc').value.trim();
  const kumaMonitor = document.getElementById('link-form-kuma-monitor').value.trim();

  if (id) {
    const idx = adminData.links.findIndex(l => l.id === id);
    if (idx !== -1) {
      adminData.links[idx] = { ...adminData.links[idx], title, url, categoryId, status, description, kumaMonitor };
    }
  } else {
    const newLink = {
      id: String(Date.now()),
      title,
      url,
      categoryId,
      status,
      description,
      kumaMonitor,
      clicks: 0
    };
    adminData.links.push(newLink);
  }

  closeModal('modal-link');
  pushDataUpdate();
}

function deleteLink(id) {
  if (confirm('您确定要彻底删除该导航链接吗？此操作无法撤销。')) {
    adminData.links = adminData.links.filter(l => l.id !== id);
    pushDataUpdate();
  }
}

// --- CATEGORIES CRUD OPERATIONS ---

document.getElementById('add-category-btn').addEventListener('click', () => {
  document.getElementById('category-id').value = '';
  document.getElementById('category-form').reset();
  document.getElementById('modal-category-title').textContent = '新增分类';
  openModal('modal-category');
});

function editCategory(id) {
  const cat = adminData.categories.find(c => c.id === id);
  if (!cat) return;

  document.getElementById('category-id').value = cat.id;
  document.getElementById('category-form-name').value = cat.name;
  document.getElementById('category-form-order').value = cat.sortOrder || 1;

  document.getElementById('modal-category-title').textContent = '修改分类';
  openModal('modal-category');
}

function submitCategoryForm(e) {
  e.preventDefault();
  const id = document.getElementById('category-id').value;
  const name = document.getElementById('category-form-name').value.trim();
  const sortOrder = parseInt(document.getElementById('category-form-order').value) || 1;

  if (id) {
    const idx = adminData.categories.findIndex(c => c.id === id);
    if (idx !== -1) {
      adminData.categories[idx] = { ...adminData.categories[idx], name, sortOrder };
    }
  } else {
    const newCat = {
      id: String(Date.now()),
      name,
      sortOrder
    };
    adminData.categories.push(newCat);
  }

  closeModal('modal-category');
  pushDataUpdate();
}

function deleteCategory(id) {
  const linksUnderCategory = adminData.links.filter(l => l.categoryId === id);
  const msg = linksUnderCategory.length > 0 
    ? `该分类下存在 ${linksUnderCategory.length} 个导航链接，删除此分类后，这些链接也会一同被删除。\n确定继续删除吗？`
    : `确定要删除此分类吗？`;

  if (confirm(msg)) {
    adminData.categories = adminData.categories.filter(c => c.id !== id);
    adminData.links = adminData.links.filter(l => l.categoryId !== id);
    pushDataUpdate();
  }
}

document.getElementById('link-filter-select').addEventListener('change', (e) => {
  currentLinkFilter = e.target.value;
  renderLinksTable();
});

// --- PROFILE FORM SAVE ---
function saveProfile(e) {
  e.preventDefault();
  
  const name = document.getElementById('profile-name').value.trim();
  const avatar = document.getElementById('profile-avatar').value.trim();
  const bio = document.getElementById('profile-bio').value.trim();
  
  const socials = gatherSocialsData();

  adminData.profile = {
    name,
    avatar,
    bio,
    socials
  };

  pushDataUpdate();
}

// --- PASSWORD CHANGE HANDLER ---
async function changePassword(e) {
  e.preventDefault();
  const oldPassword = document.getElementById('pw-old').value;
  const newPassword = document.getElementById('pw-new').value;
  const confirmPassword = document.getElementById('pw-confirm').value;

  if (newPassword !== confirmPassword) {
    showToast('新密码两次输入不匹配', 'error');
    return;
  }

  try {
    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ oldPassword, newPassword })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast('密码更新成功，请记住您的新密码');
      document.getElementById('password-form').reset();
    } else {
      showToast(data.error || '旧密码验证错误', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('更新密码时网络异常，请稍后再试', 'error');
  }
}

// --- RESET STATISTICS HANDLER ---
document.getElementById('reset-stats-btn').addEventListener('click', async () => {
  if (confirm('⚠️ 警告：这将清除前台所有链接的点击数据和最近的访客图表！确定执行重置吗？')) {
    try {
      const res = await fetch('/api/admin/reset-stats', {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (!res.ok) throw new Error('重置失败');
      
      showToast('统计分析数据重置成功！');
      fetchAdminData();
    } catch (err) {
      console.error(err);
      showToast('无法连接后台，重置请求失败', 'error');
    }
  }
});

// --- logout handler (Upgraded to call logout API) ---
document.getElementById('logout-btn').addEventListener('click', async () => {
  if (confirm('确认安全退出管理控制台吗？')) {
    try {
      await fetch('/api/logout', { method: 'POST' });
      location.href = 'login.html';
    } catch (err) {
      console.error('注销网络错误:', err);
      // Fallback
      location.href = 'login.html';
    }
  }
});

// --- PANEL SWITCH ROUTER ---
function initPanelRouter() {
  const menuItems = document.querySelectorAll('.admin-menu-item[data-panel]');
  const panels = document.querySelectorAll('.admin-panel-content');

  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetPanelId = `panel-${item.getAttribute('data-panel')}`;
      
      menuItems.forEach(m => m.classList.remove('active'));
      item.classList.add('active');

      panels.forEach(p => {
        p.style.display = (p.id === targetPanelId) ? 'block' : 'none';
      });

      if (targetPanelId === 'panel-dashboard') {
        setTimeout(initViewsChart, 50);
      }
    });
  });
}

// --- HIGH-DPI CANVAS BAR CHART ENGINE ---
let resizeTimer;
function initViewsChart() {
  const canvas = document.getElementById('views-chart');
  if (!canvas) return;

  const viewsData = adminData.analytics.views || [];
  
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;

  ctx.clearRect(0, 0, width, height);

  if (viewsData.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '14px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText('暂无近 14 天访问趋势数据', width / 2, height / 2);
    return;
  }

  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 50;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(...viewsData.map(v => v.count), 5);
  const stepCount = 5;

  ctx.lineWidth = 1;
  ctx.strokeStyle = document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,0.06)' : 'rgba(0, 0, 0, 0.05)';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let i = 0; i <= stepCount; i++) {
    const val = Math.round((maxVal / stepCount) * i);
    const y = paddingTop + chartHeight - (chartHeight / stepCount) * i;
    
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();

    ctx.fillText(String(val), paddingLeft - 10, y);
  }

  const barCount = viewsData.length;
  const barSpacing = chartWidth / barCount;
  const barWidth = Math.max(barSpacing * 0.55, 8);

  viewsData.forEach((record, index) => {
    const x = paddingLeft + barSpacing * index + (barSpacing - barWidth) / 2;
    const barHeight = (record.count / maxVal) * chartHeight;
    const y = paddingTop + chartHeight - barHeight;

    const primaryHsl = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    ctx.fillStyle = primaryHsl || '#3b82f6';
    
    drawRoundedRect(ctx, x, y, barWidth, barHeight, 6);

    ctx.save();
    ctx.translate(x + barWidth / 2, paddingTop + chartHeight + 10);
    ctx.rotate(-Math.PI / 6);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText(record.date, 0, 0);
    ctx.restore();

    if (record.count > 0) {
      ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(record.count), x + barWidth / 2, y - 10);
    }
  });

  ctx.strokeStyle = document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,0.1)' : 'rgba(0, 0, 0, 0.1)';
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop + chartHeight);
  ctx.lineTo(width - paddingRight, paddingTop + chartHeight);
  ctx.stroke();
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  if (h <= 0) return;
  if (h < 2 * r) r = h / 2;
  
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    initViewsChart();
  }, 150);
});

const themeObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.attributeName === 'class') {
      initViewsChart();
    }
  });
});
themeObserver.observe(document.documentElement, { attributes: true });

// --- INITIALIZE DOM HANDLER ---
document.addEventListener('DOMContentLoaded', () => {
  initPanelRouter();
  attachSlidersLivePreview();
  
  // Directly fetch data: auth state check happens implicitly (browser attaches cookie)
  fetchAdminData();
});
