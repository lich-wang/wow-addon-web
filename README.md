# WoW Web Addon Manager (魔兽世界本地插件 Web 管理器)

<p align="center">
  <img src="public/favicon.svg" width="96" height="96" alt="WoW Web Addon Manager Logo" />
</p>

<p align="center">
  <strong>零客户端安装 · 纯网页端管理 · 本地目录直读写 · 100% 浏览器沙箱安全 · 免费部署于 Cloudflare Pages</strong>
</p>

<p align="center">
  <a href="https://github.com/lich-wang/wow-addon-web/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="https://pages.cloudflare.com/"><img src="https://img.shields.io/badge/Deploy%20on-Cloudflare%20Pages-orange?logo=cloudflare" alt="Cloudflare Pages" /></a>
  <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Built%20with-Vite%20%2B%20React%20%2B%20Tailwind-646cff?logo=vite" alt="Tech Stack" /></a>
</p>

---

## 🌟 核心亮点

传统魔兽世界插件管理器（如 CurseForge 客户端）通常需要下载安装几十上百兆的后台常驻软件，并伴随广告、自启和资源占用。

**WoW Web Addon Manager** 采用现代浏览器的 **File System Access API**，实现了一个**完全免安装**的纯 Web 解决方案：
- 🌐 **零客户端安装**：只需 Chrome / Edge / Brave 浏览器打开网址即可使用。
- ⚡ **本地目录直接读写**：用户授权选定 `World of Warcraft\_retail_\Interface\AddOns` 目录后，网页直接本地扫描插件与 TOC 元数据。
- 🛡️ **100% 隐私与安全**：所有文件解析、解压与写入均在用户浏览器本地沙箱中执行，无需将游戏账号和配置上传到任何中心化服务器。
- 📦 **本地 ZIP 拖入即装**：支持将下载好的插件 `.zip` 包直接拖入网页，自动在浏览器内存中解压缩并规整写入本地目录。
- 🛒 **常用精品市场**：内置 Details!、WeakAuras、DBM、BigWigs、Plater、MDT、Bartender4、OmniCC、Bagnon 等常用大秘境/团本插件，支持一键直达安装。
- 🔄 **跨设备清单导出**：一键导出本地已装插件 JSON 清单，方便换电脑、去网吧或与公会队友一键对齐。
- ☁️ **Cloudflare Pages 免费部署**：完全兼容 Cloudflare Pages 静态托管与 Functions 边缘代理，全球 CDN 毫秒级加速。

---

## 🛠️ 技术栈

- **前端框架**：React 19 + TypeScript + Vite 6
- **样式引擎**：Tailwind CSS v4
- **本地存储与文件读写**：
  - File System Access API (`window.showDirectoryPicker`, `FileSystemDirectoryHandle`)
  - IndexedDB (`idb-keyval` 保存授权句柄，刷新免重新寻址)
  - `JSZip`（浏览器内存解压缩与文件流式写入）
- **边缘函数**：Cloudflare Pages Functions (`functions/api/proxy.ts` 提供边缘 CORS 加速转发通道)

---

## 🚀 快速上手与本地开发

### 环境要求
- Node.js 18+ 或 20+
- 推荐使用 **Google Chrome**、**Microsoft Edge** 或 **Brave** 浏览器（需要支持 File System Access API）

### 运行步骤
```bash
# 1. 克隆仓库
git clone https://github.com/lich-wang/wow-addon-web.git
cd wow-addon-web

# 2. 安装依赖
npm install

# 3. 启动本地开发服务器
npm run dev
```

打开浏览器访问 `http://localhost:5173`。

---

## ☁️ 部署到 Cloudflare Pages

本项目可以**完全免费**部署在 Cloudflare Pages 上，具备永久免费的 SSL 证书（HTTPS）与全球 CDN：

1. **推送到 GitHub**：
   将代码推送到你的 GitHub 仓库（`https://github.com/lich-wang/wow-addon-web`）。
2. **进入 Cloudflare 控制台**：
   访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)，在左侧导航栏点击 **Workers 与 Pages** → **创建应用程序** → 选择 **Pages** → **连接到 Git**。
3. **选择仓库并配置构建参数**：
   - **项目名称**：`wow-addon-web`
   - **框架预设 (Framework preset)**：`Vite`
   - **构建命令 (Build command)**：`npm run build`
   - **构建输出目录 (Build output directory)**：`dist`
4. **点击“保存并部署”**：
   构建完成后，即可通过 `https://wow.lich.tech` 全球访问！

---

## 📖 使用指南

1. **选择插件目录**：
   - 打开网页，点击 **“选择魔兽世界 AddOns 目录”** 按钮。
   - 常见魔兽安装路径：
     - 正式服：`C:\Program Files (x86)\World of Warcraft\_retail_\Interface\AddOns`
     - 怀旧服：`C:\Program Files (x86)\World of Warcraft\_classic_\Interface\AddOns`
   - *提示：即使你选了 `_retail_` 或魔兽根目录，网页也会智能自动寻址到 `Interface/AddOns`。*
2. **管理本地插件**：
   - 网页会自动解析每个插件文件夹中的 `.toc` 文件，展示插件中文/英文名称、版本号、作者、文件数及占用体积。
   - 支持一键复制文件夹名、搜索过滤或彻底卸载删除。
3. **安装新插件**：
   - **拖拽安装**：点击顶部 “安装 ZIP”，把从任意网站下载的插件压缩包拖入，网页自动为你解压写入。
   - **市场一键安装**：切换到 “常用插件市场”，点击对应插件的 “一键安装”。
4. **备份与分享**：
   - 点击右上角分享图标，可以生成并下载当前已装插件的 JSON 清单。

---

## 🔒 浏览器安全说明

- 本应用严格遵循 W3C File System Access API 规范。
- 浏览器只会在用户**显式点击授权**后，才对指定的魔兽世界插件文件夹拥有读写权限。
- 网页关闭后重新进入时，浏览器为了安全性会显示一次“一键恢复授权”提示，点击即可恢复，无需重复选目录。
- **Firefox 与 Safari** 尚未完全开放本地目录读写规范，因此推荐使用基于 Chromium 的主流浏览器。

---

## 🤝 开源协议

本项目基于 [MIT License](LICENSE) 开源，欢迎提交 Issue 和 Pull Request！
