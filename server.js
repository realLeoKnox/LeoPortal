const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Database File Configuration
const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let db = {};
let kumaMonitorStatuses = {}; // Memory cache of Uptime Kuma statuses: { "Monitor Name": 1 }
let kumaIntervalId = null;

function saveDatabase() {
  fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf8', (err) => {
    if (err) console.error('异步保存数据库失败:', err);
  });
}

function saveDatabaseSync() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('同步保存数据库失败:', err);
  }
}

// Helper: Secure password hashing
function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

// Helper: Custom stateless token signing
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

function generateToken(username) {
  const expiry = Date.now() + 24 * 60 * 60 * 1000;
  const data = `${username}.${expiry}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex');
  return `${data}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [username, expiry, signature] = parts;
  if (parseInt(expiry) < Date.now()) return null;
  
  const data = `${username}.${expiry}`;
  const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex');
  if (signature !== expectedSignature) return null;
  return username;
}

// Helper: Lightweight Cookie Parser
function getCookie(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.split('=').map(c => c.trim());
    if (key) acc[key] = value;
    return acc;
  }, {});
  
  return cookies[name] || null;
}

// Authentication Middleware
function authenticateAdmin(req, res, next) {
  const token = getCookie(req, 'admin_token');
  if (!token) {
    return res.status(401).json({ error: '未授权：缺少身份凭证Cookie' });
  }
  const username = verifyToken(token);
  if (!username) {
    return res.status(401).json({ error: '未授权：身份凭证已过期或无效' });
  }
  req.username = username;
  next();
}

// Rate Limiting for Login
const loginAttempts = new Map();
function rateLimiter(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const limitTime = 60 * 1000;
  const maxAttempts = 5;

  if (!loginAttempts.has(ip)) {
    loginAttempts.set(ip, []);
  }

  const attempts = loginAttempts.get(ip).filter(timestamp => now - timestamp < limitTime);
  attempts.push(now);
  loginAttempts.set(ip, attempts);

  if (attempts.length > maxAttempts) {
    return res.status(429).json({ error: '请求过于频繁，请在 1 分钟后重试' });
  }
  next();
}

// Seed configs
const defaultSearchEngines = [
  { id: 'google', name: 'Google', url: 'https://www.google.com/search?q={query}', placeholder: 'Google 搜索...', sortOrder: 1, isDefault: true },
  { id: 'baidu', name: 'Baidu', url: 'https://www.baidu.com/s?wd={query}', placeholder: '百度一下...', sortOrder: 2, isDefault: false },
  { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q={query}', placeholder: '必应搜索...', sortOrder: 3, isDefault: false },
  { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q={query}', placeholder: 'DuckDuckGo...', sortOrder: 4, isDefault: false }
];

const defaultSiteConfig = {
  title: 'Leo Portal | 快速导航',
  favicon: '⛵',
  logoIcon: '⛵',
  logoSub: '快速导航',
  footerText: '© 2026 Leo Portal. Crafted with Glassmorphism.',
  scriptInjection: '',
  // Default Uptime Kuma Settings
  kumaEnabled: false,
  kumaUrl: '',
  kumaSlug: 'default',
  kumaInterval: 60
};

const defaultThemeConfig = {
  primaryHue: 215,
  accentHue: 260,
  glassBlur: 16,
  glassOpacity: 0.65,
  borderRadius: 20,
  bgImage: '',
  customCss: ''
};

// Background Fetching Module for Uptime Kuma
async function fetchKumaStatuses() {
  const sc = db.siteConfig || {};
  if (!sc.kumaEnabled || !sc.kumaUrl || !sc.kumaSlug) {
    kumaMonitorStatuses = {};
    return;
  }

  let kumaUrlClean = sc.kumaUrl.trim();
  let slug = sc.kumaSlug.trim();

  // Robust parsing 1: If user pasted full status page URL into kumaUrl field
  if (kumaUrlClean.includes('/status/')) {
    const parts = kumaUrlClean.split('/status/');
    kumaUrlClean = parts[0];
    if (!slug || slug === 'default' || slug === 'status/test') {
      slug = parts[1];
    }
  }

  // Robust parsing 2: If slug contains 'status/'
  if (slug.includes('status/')) {
    const parts = slug.split('status/');
    slug = parts[parts.length - 1];
  }

  // Robust parsing 3: If user pasted full URL into slug field
  if (slug.startsWith('http://') || slug.startsWith('https://')) {
    try {
      const parsed = new URL(slug);
      kumaUrlClean = parsed.origin;
      const pathParts = parsed.pathname.split('status/');
      if (pathParts.length > 1) {
        slug = pathParts[1];
      } else {
        slug = parsed.pathname.replace(/^\//, '');
      }
    } catch (e) {
      // ignore
    }
  }

  kumaUrlClean = kumaUrlClean.replace(/\/$/, '');
  slug = slug.replace(/\/$/, '');

  const configUrl = `${kumaUrlClean}/api/status-page/${slug}`;
  const heartbeatUrl = `${kumaUrlClean}/api/status-page/heartbeat/${slug}`;
  console.log(`[Uptime Kuma] 正在从状态页拉取数据. 配置: ${configUrl}, 心跳: ${heartbeatUrl}`);

  try {
    // 1. 获取状态页配置（映射监控项 ID -> 名称）
    const configResponse = await fetch(configUrl, { signal: AbortSignal.timeout(6000) });
    if (!configResponse.ok) throw new Error(`获取配置接口异常 ${configResponse.status}`);
    const configData = await configResponse.json();

    // 2. 获取心跳状态数据
    const heartbeatResponse = await fetch(heartbeatUrl, { signal: AbortSignal.timeout(6000) });
    if (!heartbeatResponse.ok) throw new Error(`获取心跳接口异常 ${heartbeatResponse.status}`);
    const heartbeatData = await heartbeatResponse.json();

    // 解析出所有的 monitor ID 与名称的映射
    const monitors = [];
    const publicGroupList = configData.publicGroupList || [];
    publicGroupList.forEach(group => {
      const groupMonitors = group.monitorList || [];
      groupMonitors.forEach(m => {
        monitors.push({ id: m.id, name: m.name });
      });
    });

    const heartbeatList = heartbeatData.heartbeatList || {};
    const newStatuses = {};

    monitors.forEach(m => {
      const heartbeats = heartbeatList[m.id];
      if (heartbeats && heartbeats.length > 0) {
        // 查找最新一次心跳状态
        const latest = heartbeats[heartbeats.length - 1];
        // 提取最近最多 30 次检测的心跳状态值数组
        const history = heartbeats.slice(-30).map(h => h.status);
        newStatuses[m.name] = {
          status: latest.status, // 0=down, 1=up, 2=pending, 3=maintenance
          history: history
        };
      } else {
        newStatuses[m.name] = {
          status: 2, // 默认为 pending
          history: []
        };
      }
    });

    kumaMonitorStatuses = newStatuses;
    console.log(`[Uptime Kuma] 成功从 ${slug} 状态页同步了 ${Object.keys(newStatuses).length} 项服务指标:`, JSON.stringify(kumaMonitorStatuses));
  } catch (err) {
    console.error(`[Uptime Kuma] 从状态页 ${slug} 抓取数据失败:`, err.message);
  }
}

function startKumaFetchLoop() {
  if (kumaIntervalId) {
    clearInterval(kumaIntervalId);
    kumaIntervalId = null;
  }

  const sc = db.siteConfig || {};
  if (sc.kumaEnabled && sc.kumaUrl && sc.kumaSlug) {
    // Run initial fetch
    fetchKumaStatuses();
    const intervalSec = parseInt(sc.kumaInterval) || 60;
    kumaIntervalId = setInterval(fetchKumaStatuses, intervalSec * 1000);
    console.log(`[Uptime Kuma] 后台拉取任务已启动，轮询周期：${intervalSec} 秒`);
  } else {
    kumaMonitorStatuses = {};
    console.log(`[Uptime Kuma] 后台拉取任务已关闭或未配置`);
  }
}

// Auto Migration Runner
function runMigrations() {
  let updated = false;

  if (db.profile && db.profile.socials && !Array.isArray(db.profile.socials)) {
    const oldSocials = db.profile.socials;
    db.profile.socials = [];
    if (oldSocials.github) db.profile.socials.push({ platform: 'GitHub', icon: '🐙', url: oldSocials.github });
    if (oldSocials.telegram) db.profile.socials.push({ platform: 'Telegram', icon: '✈️', url: oldSocials.telegram });
    if (oldSocials.email) db.profile.socials.push({ platform: 'Email', icon: '✉️', url: oldSocials.email });
    updated = true;
  }

  if (!db.searchEngines) {
    db.searchEngines = defaultSearchEngines;
    updated = true;
  }

  if (!db.siteConfig) {
    db.siteConfig = defaultSiteConfig;
    updated = true;
  } else {
    // Upgrade siteConfig to include Uptime Kuma fields if missing
    if (db.siteConfig.kumaEnabled === undefined) {
      db.siteConfig.kumaEnabled = defaultSiteConfig.kumaEnabled;
      db.siteConfig.kumaUrl = defaultSiteConfig.kumaUrl;
      db.siteConfig.kumaSlug = defaultSiteConfig.kumaSlug;
      db.siteConfig.kumaInterval = defaultSiteConfig.kumaInterval;
      updated = true;
    }
    // Upgrade to include custom logo configurations if missing
    if (db.siteConfig.logoIcon === undefined) {
      db.siteConfig.logoIcon = defaultSiteConfig.logoIcon || '⛵';
      updated = true;
    }
    if (db.siteConfig.logoSub === undefined) {
      db.siteConfig.logoSub = defaultSiteConfig.logoSub || '优雅导航';
      updated = true;
    }
  }

  if (!db.themeConfig) {
    db.themeConfig = defaultThemeConfig;
    updated = true;
  }

  // Ensure all links have kumaMonitor key
  if (db.links) {
    db.links.forEach(l => {
      if (l.kumaMonitor === undefined) {
        l.kumaMonitor = '';
        updated = true;
      }
    });
  }

  if (updated) {
    saveDatabaseSync();
  }
}

// Initialize database
function initializeDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      runMigrations();
      return;
    } catch (e) {
      console.error('读取数据库失败，正在重新初始化...', e);
    }
  }

  const defaultSalt = generateSalt();
  const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const defaultAdminUsername = process.env.ADMIN_USERNAME || 'admin';

  const analyticsViews = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0].substring(5);
    const mockCounts = [2, 0, 5, 1, 8, 3, 11, 6, 12, 17, 9, 22, 12, 1];
    analyticsViews.push({ date: dateStr, count: mockCounts[13 - i] || 0 });
  }

  db = {
    admin: {
      username: defaultAdminUsername,
      salt: defaultSalt,
      hash: hashPassword(defaultAdminPassword, defaultSalt)
    },
    profile: {
      name: 'LeoKnox',
      bio: '收集常用工具、安全入口和个人系统，保持简洁、高效、安全。',
      avatar: '⛵',
      socials: [
        { platform: 'GitHub', icon: '🐙', url: 'https://github.com' }
      ]
    },
    categories: [
      { id: '1', name: '常用站点', sortOrder: 1 }
    ],
    links: [
      { id: '1', categoryId: '1', title: 'GitHub', description: '开源代码托管与协作平台，全球最大的开发者社区。', url: 'https://github.com', status: 'public', clicks: 0, kumaMonitor: '' },
      { id: '2', categoryId: '1', title: 'Google', description: '干净快捷的信息检索工具与全球最大的搜索引擎。', url: 'https://google.com', status: 'public', clicks: 0, kumaMonitor: '' },
      { id: '3', categoryId: '1', title: 'YouTube', description: '全球最大的视频分享与影音播放平台。', url: 'https://youtube.com', status: 'public', clicks: 0, kumaMonitor: '' },
      { id: '4', categoryId: '1', title: 'NodeSeek', description: '高品质 VPS 主机与网络技术交流讨论论坛。', url: 'https://www.nodeseek.com', status: 'public', clicks: 0, kumaMonitor: '' }
    ],
    searchEngines: defaultSearchEngines,
    siteConfig: defaultSiteConfig,
    themeConfig: defaultThemeConfig,
    analytics: {
      views: analyticsViews
    }
  };

  saveDatabaseSync();
}

// Initialize database & start background polling
initializeDatabase();
startKumaFetchLoop();

// --- PUBLIC API ROUTES ---

// 1. Get all data for rendering frontend portal (Includes Uptime Kuma status tags if active)
app.get('/api/data', (req, res) => {
  const token = getCookie(req, 'admin_token');
  const isAdmin = token ? !!verifyToken(token) : false;

  const filteredLinks = isAdmin
    ? db.links.filter(link => link.status === 'public' || link.status === 'private')
    : db.links.filter(link => link.status === 'public');

  // Map Uptime Kuma statuses dynamically into links
  const linksWithStatuses = filteredLinks.map(link => {
    // Match by custom kumaMonitor name, or fall back to link title
    const matchName = link.kumaMonitor || link.title;
    const hasStatus = kumaMonitorStatuses[matchName] !== undefined;
    
    return {
      ...link,
      statusKuma: hasStatus ? kumaMonitorStatuses[matchName] : null // 0=down, 1=up, 2=pending, 3=maintenance, null=no config
    };
  });

  const publicData = {
    profile: db.profile,
    categories: [...db.categories].sort((a, b) => a.sortOrder - b.sortOrder),
    links: linksWithStatuses,
    searchEngines: [...(db.searchEngines || defaultSearchEngines)].sort((a, b) => a.sortOrder - b.sortOrder),
    siteConfig: db.siteConfig || defaultSiteConfig,
    themeConfig: db.themeConfig || defaultThemeConfig,
    isAdmin: isAdmin
  };
  res.json(publicData);
});

// 2. Log clicks
app.post('/api/click/:id', (req, res) => {
  const linkId = req.params.id;
  const link = db.links.find(l => l.id === linkId);
  if (link) {
    link.clicks = (link.clicks || 0) + 1;
    saveDatabase();
    return res.json({ success: true, clicks: link.clicks });
  }
  res.status(404).json({ error: '未找到该链接' });
});

// 3. Log site visitor
app.post('/api/visit', (req, res) => {
  const todayStr = new Date().toISOString().split('T')[0].substring(5);
  
  if (!db.analytics) db.analytics = { views: [] };
  if (!db.analytics.views) db.analytics.views = [];

  let todayRecord = db.analytics.views.find(v => v.date === todayStr);
  if (todayRecord) {
    todayRecord.count += 1;
  } else {
    db.analytics.views.push({ date: todayStr, count: 1 });
    if (db.analytics.views.length > 30) {
      db.analytics.views.shift();
    }
  }
  saveDatabase();
  res.json({ success: true });
});

// 4. Admin Login
app.post('/api/login', rateLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const adminUser = db.admin;
  if (username !== adminUser.username) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const hash = hashPassword(password, adminUser.salt);
  if (hash === adminUser.hash) {
    const token = generateToken(username);
    
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.json({ success: true });
  } else {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
});

// 5. Admin Logout
app.post('/api/logout', (req, res) => {
  res.clearCookie('admin_token', { path: '/' });
  res.json({ success: true });
});

// --- ADMIN API ROUTES (Protected) ---

// 6. Get complete admin dataset
app.get('/api/admin/data', authenticateAdmin, (req, res) => {
  res.json({
    profile: db.profile,
    categories: db.categories,
    links: db.links,
    searchEngines: db.searchEngines || defaultSearchEngines,
    siteConfig: db.siteConfig || defaultSiteConfig,
    themeConfig: db.themeConfig || defaultThemeConfig,
    analytics: db.analytics || { views: [] }
  });
});

// 7. Update administrative data (Triggers Kuma loop reload if settings changed)
app.post('/api/admin/update', authenticateAdmin, (req, res) => {
  const { profile, categories, links, searchEngines, siteConfig, themeConfig } = req.body;

  // Track if Kuma settings changed
  let kumaChanged = false;
  if (siteConfig && db.siteConfig) {
    if (
      siteConfig.kumaEnabled !== db.siteConfig.kumaEnabled ||
      siteConfig.kumaUrl !== db.siteConfig.kumaUrl ||
      siteConfig.kumaSlug !== db.siteConfig.kumaSlug ||
      siteConfig.kumaInterval !== db.siteConfig.kumaInterval
    ) {
      kumaChanged = true;
    }
  }

  if (profile) db.profile = profile;
  if (categories) db.categories = categories;
  if (searchEngines) db.searchEngines = searchEngines;
  if (siteConfig) db.siteConfig = siteConfig;
  if (themeConfig) db.themeConfig = themeConfig;
  
  if (links) {
    db.links = links.map(newLink => {
      const oldLink = db.links.find(ol => ol.id === newLink.id);
      return {
        ...newLink,
        clicks: oldLink ? oldLink.clicks : (newLink.clicks || 0),
        kumaMonitor: newLink.kumaMonitor !== undefined ? newLink.kumaMonitor : (oldLink ? oldLink.kumaMonitor : '')
      };
    });
  }

  saveDatabase();

  // Re-establish fetching loop if configuration was edited
  if (kumaChanged) {
    startKumaFetchLoop();
  }

  res.json({ success: true });
});

// 8. Change Admin Password
app.post('/api/admin/change-password', authenticateAdmin, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: '密码字段不能为空' });
  }

  const adminUser = db.admin;
  const oldHash = hashPassword(oldPassword, adminUser.salt);

  if (oldHash !== adminUser.hash) {
    return res.status(400).json({ error: '旧密码输入错误' });
  }

  const newSalt = generateSalt();
  adminUser.salt = newSalt;
  adminUser.hash = hashPassword(newPassword, newSalt);

  saveDatabaseSync();
  res.json({ success: true, message: '密码修改成功' });
});

// 9. Reset Statistics
app.post('/api/admin/reset-stats', authenticateAdmin, (req, res) => {
  db.links.forEach(l => l.clicks = 0);
  
  const emptyViews = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0].substring(5);
    emptyViews.push({ date: dateStr, count: 0 });
  }
  db.analytics = { views: emptyViews };

  saveDatabaseSync();
  res.json({ success: true, message: '数据统计已重置' });
});

// 10. Export Backup File
app.get('/api/admin/backup', authenticateAdmin, (req, res) => {
  const backup = JSON.parse(JSON.stringify(db));
  delete backup.admin;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="nav_db_backup.json"');
  res.send(JSON.stringify(backup, null, 2));
});

// 11. Import/Restore Backup File
app.post('/api/admin/restore', authenticateAdmin, (req, res) => {
  const backupData = req.body;
  
  if (!backupData || !backupData.links || !backupData.categories) {
    return res.status(400).json({ error: '无效的备份数据文件结构' });
  }

  const currentAdmin = db.admin;

  db = {
    ...db,
    ...backupData,
    admin: currentAdmin
  };

  saveDatabaseSync();
  startKumaFetchLoop(); // Reload monitor loops with restored configs
  res.json({ success: true });
});

// Start the server
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(` 🚀 导航系统后台已升级启动 `);
  console.log(` 📡 运行地址: http://localhost:${PORT}`);
  console.log(`===================================================`);
});
