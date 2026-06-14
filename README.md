# ⛵ Leo Portal | 优雅的毛玻璃个人导航门户

Leo Portal 是一款基于 **Node.js** 和 **Vanilla CSS** 开发的轻量级、高颜值个人导航门户系统。系统采用极具现代感的 **毛玻璃渐变设计（Glassmorphism UI）**，不仅支持完全的可视化主题定制，还集成了完整的管理员后台控制面板、访客流量分析统计图表，并原生支持与 **Uptime Kuma** 自建监控系统的深度集成。

---

## ✨ 核心亮点

* 🎨 **高颜值毛玻璃主题**：磨砂感玻璃质感背景，支持后台在线通过滑块调整主色调色相（Hue）、辅助色调色相、模糊度（Blur）、不透明度（Opacity）、圆角大小，并支持自定义背景图片和注入自定义 CSS 规则。
* 🔌 **Uptime Kuma 深度集成**：
  * **呼吸灯状态指示器**：绿灯（在线）、红灯（离线）、黄灯（维护）三种高精度 CSS 脉冲动画，实时展示各个站点的运行状态。
  * **简约历史状态长条**：卡片下方展示最近 30 次心跳检测的历史长条记录（绿/红/黄/灰方块拼接），支持鼠标 hover 单次状态提示。
  * **智能 URL/Slug 过滤**：后台配置支持粘贴完整的 Uptime Kuma 状态页链接，系统会自动识别解析服务 IP 与 Slug 标识。
* 🔒 **多级访问权限隔离**：
  * 卡片支持三种显示状态：**公开**（所有人可见）、**私密**（仅管理员登录后可见）、**隐藏**（仅控制台管理可见）。保护内网 NAS、路由器、软路由等私密个人系统入口。
* 🛡️ **HTTP-Only Cookie 安全鉴权**：
  * 弃用本地存储方案，采用 `HTTP-Only` 和 `SameSite=Strict` Cookie 校验会话状态，有效防御 XSS 和 CSRF 攻击。
  * 内置密码加盐 PBKDF2 强哈希算法、后台登录频次限制器（Rate Limiter），全面保障后台安全。
* 📊 **直观的访客统计与热门点击排行**：
  * 仪表盘内置使用 HTML5 Canvas 绘制的 14 天每日访问量（PV）趋势曲线图，直观展现站点热度。
  * 卡片点击量自动统计，后台实时展示 Top 5 热门点击排行榜。
* 🔍 **动态搜索引擎管理**：内置多引擎聚合搜索栏，管理员可在后台自主新增、编辑、删除搜索引擎，自定义检索模板路径（带 `{query}`）及默认排序。
* 💾 **一键数据备份与恢复**：支持一键导出包含链接、分类、搜索引擎及主题的所有配置为 `.json` 数据包，随时随地上载覆盖恢复。

---

## 🛠️ 项目结构

```text
/Users/leoknox/data/Code/Antigravity/
├── .env                   # 本地环境变量配置文件
├── .env.example           # 环境变量配置模板
├── Dockerfile             # 跨平台构建 Docker 容器镜像配置
├── package.json           # 项目基本说明与依赖配置文件
├── package-lock.json      # 依赖版本锁文件
├── server.js              # 服务端核心逻辑（Express 路由、数据持久化、Uptime Kuma 联合抓取）
├── data/
│   └── db.json            # 本地 JSON 数据库文件（首次运行自动生成并初始化默认配置）
└── public/                # 前台与控制台静态资源文件夹
    ├── index.html         # 游客与站长公共导航前台
    ├── login.html         # 管理员安全登录页面
    ├── admin.html         # 管理控制台 SPA 单页控制面板
    ├── css/
    │   └── style.css      # 全局样式表（包含呼吸动画、毛玻璃主题、Uptime 历史条等样式）
    └── js/
        ├── frontend.js    # 导航前台渲染与三方脚本注入逻辑
        └── admin.js       # 管理控制台交互、图表绘制与 CRUD 传输逻辑
```

---

## 📦 技术栈与依赖说明

为保证系统在多平台（如 macOS、Debian Linux、树莓派等环境）上能够**无障碍快速编译与运行**，项目不含任何需要本地 C/C++ 编译器构建的 native 依赖包。

### 核心依赖
* **Express** (`^4.19.2`)：轻量级 Node.js Web 服务端框架。
* **Cors** (`^2.8.5`)：提供跨域资源共享中间件。
* **Dotenv** (`^16.4.5`)：零依赖环境变量加载模块。

### 系统要求
* **Node.js**：`>= 18.0.0` （内置支持 `fetch` API 以抓取监控接口）。

---

## 🚀 两种部署与运行方式

### 方式一：本地 Node.js 运行（开发与轻量部署首选）

1. **安装项目依赖**
   ```bash
   npm install
   ```

2. **配置环境变量**
   在项目根目录下复制模板生成 `.env` 配置文件：
   ```bash
   cp .env.example .env
   ```
   用文本编辑器打开 `.env` 并进行自定义配置：
   ```ini
   PORT=8080
   JWT_SECRET=your-random-jwt-secret-key-here
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=admin123
   ```

3. **启动服务**
   ```bash
   npm start
   ```
   服务启动后将监听：`http://localhost:8080`

---

### 方式二：Docker 容器化运行（多平台生产部署首选）

采用 `node:18-alpine` 基础镜像，构建出的镜像体积小且十分安全。

1. **构建 Docker 镜像**
   在项目根目录下执行构建命令：
   ```bash
   docker build -t leo-portal .
   ```

2. **运行 Docker 容器**
   通过映射宿主机挂载 `data/` 目录以确保持久化数据库在容器重启后不丢失：
   ```bash
   docker run -d \
     -p 8080:8080 \
     -v $(pwd)/data:/app/data \
     --env-file .env \
     --name nav-portal \
     leo-portal
   ```

3. **常用容器命令**
   * **查看日志**：`docker logs -f nav-portal`
   * **停止容器**：`docker stop nav-portal`
   * **启动容器**：`docker start nav-portal`

---

## 🔌 Uptime Kuma 状态监控集成指引

1. **Kuma 状态页配置**：
   * 登录您的 **Uptime Kuma** 后台，创建一个公开的状态页面（Status Page），并设置一个 **Slug**（例如 `test`）。
   * 将需要展示状态的监控项关联添加到该状态页面中。

2. **导航控制台设置**：
   * 登录导航站后台，进入 **“全局与主题”**。
   * 找到 **“🔌 Uptime Kuma 状态监控集成”** 卡片，勾选启用。
   * 填入您的 **Uptime Kuma 实例 URL**（例如：`http://127.0.0.1:3001` 或完整公开状态页地址 `http://127.0.0.1:3001/status/test`）。
   * 填入状态页 **Slug**（例如：`test` 或 `status/test`，系统会自动清洗解析）。
   * 设定轮询周期并保存。

3. **关联卡片服务**：
   * 进入 **“链接管理”**，编辑或新增想要展示状态的卡片。
   * 在 **“Uptime Kuma 关联监控项名称”** 输入框中，填写该服务在 Uptime Kuma 中设置的 **Monitor Name**。
   * 点击保存。返回前台，卡片头部就会展示炫酷的呼吸状态指示灯，底部会自动渲染简约的历史状态条！
