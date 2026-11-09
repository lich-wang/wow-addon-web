# WoW Web Addon Manager (魔兽世界本地插件在线管理器与汉化市场)

<p align="center">
  <img src="public/favicon.svg" width="96" height="96" alt="WoW Web Addon Manager Logo" />
</p>

<p align="center">
  <strong>免设置直接下载 ZIP · 纯网页端直连管理 · Tauri 2.0 原生桌面端 · 无限服 100% 深度汉化精选库 · 免费部署于 Cloudflare Pages</strong>
</p>

<p align="center">
  <a href="https://github.com/lich-wang/wow-addon-web/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="https://pages.cloudflare.com/"><img src="https://img.shields.io/badge/Deploy%20on-Cloudflare%20Pages-orange?logo=cloudflare" alt="Cloudflare Pages" /></a>
  <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Built%20with-Vite%20%2B%20React%2019%20%2B%20Tailwind-646cff?logo=vite" alt="Tech Stack" /></a>
  <a href="https://v2.tauri.app/"><img src="https://img.shields.io/badge/Desktop-Tauri%202.0%20(Win%20%2F%20Mac)-24c8db?logo=tauri" alt="Tauri 2.0" /></a>
</p>

---

## 🌟 核心亮点

传统魔兽世界插件管理器（如 CurseForge 客户端）通常需要下载安装臃肿的后台常驻软件，并伴随广告、自启和资源占用。

**WoW Web Addon Manager** 采用 **「免配置直下 + 浏览器 File System Access API + Tauri 2.0 原生桌面端」** 三位一体的轻量架构，提供开箱即用的插件获取与管理体验：

- 📦 **免设置直接下载 ZIP（零门槛即下即用）**：无需授权或配置任何本地目录，打开网站首页即可直接浏览精选插件市场，一键下载 `.zip` 插件压缩包（兼容所有桌面与移动浏览器）。
- 🌐 **纯网页端直连读写**：在 Chrome / Edge / Brave 浏览器中授权选定 `Interface\AddOns` 目录后，网页可在本地沙箱中直接扫描 `.toc` 元数据，并支持从市场流式下载并自动解压安装插件。
- 🖥️ **Windows / macOS 原生客户端与本地助手**：提供基于 **Tauri 2.0 (Rust)** 构建的跨平台客户端（Windows 单文件绿色免安装 `.exe` 与 macOS `.dmg`），彻底解除 Chromium 浏览器对 `C:\Program Files` 系统盘保护目录的拦截以及 macOS Safari 的沙箱限制，并支持**自动扫描本机魔兽目录与实时感应正在运行的游戏版本**。
- 🇨🇳 **《魔兽世界：无限服 (WoW Forever)》深度汉化市场**：内置多款针对无限服、经典旧世与正式服深度本地化的精品插件，完成 100% 简体中文翻译与货币/界面细节适配。
- 🧩 **多模块组件智能聚合**：自动识别并归组多文件夹复合插件（如 `Bagnon` 全家桶、`IceHUD` 模块套件等），在已装列表中合并为单一卡片清爽展示，并支持一键连带全部子目录彻底卸载。
- 📥 **本地 ZIP 拖入即装 & 清单分享**：支持将任意第三方下载的 `.zip` 插件包拖入网页自动解压写入，支持一键导出本地已装插件 JSON 清单。
- 🛡️ **100% 本地安全与隐私**：所有文件解析、解压与写入均在本地完成，绝不上传任何游戏账号或个人配置数据。

---

## 🛒 内置精选全汉化插件库

项目首页内置托管了以下经过深度简体中文化与适配验证的精选插件，支持**未设置目录时直接下载 `.zip`** 或**连接目录后一键自动安装**：

| 插件名称 | 主目录名 | 最新版本 | 适用版本 | 核心功能与汉化亮点 |
| :--- | :--- | :--- | :--- | :--- |
| **Single-Button Fishing (单键钓鱼)** | `SBF` | `2026.11.05.1 (中文版)` | 无限服 / 经典 / 正式服 | 钓鱼必备神器！一键完成甩竿、浮漂交互、高速拾取、换竿上饵与音频增强，**100% 全界面/日志/技能书/世界地图完整简体中文汉化**。 |
| **Blackthornes Tradeskills (商业制造与拍卖)** | `Blackthornes_TS` | `v0.64.0 (Forever 中文版)` | 无限服 / 经典怀旧 | 无限服专属商业利器！实时扫描拍卖行计算最高利润配方、排队批量制造、智能购物清单与防亏损一口价上架，**内置 2700+ 条全量简体中文及“金/银/铜”货币单位本地化**。 |
| **IceHUD (弧形战斗抬头显示)** | `IceHUD` | `v1.17.28 (全汉化版)` | 无限服 / 经典 / 正式服 | 高度可定制的弧形平视框架（HUD），将角色生命值、法力/能量、施法条与目标状态居中展现，**补全 260+ 条缺失汉化**。 |
| **Dungeonsforever (无限副本手册)** | `DungeonsForever` | `v2.1.31 (原生中文)` | 无限服 / 经典 / 正式服 | 专为经典旧世与无限服打造的内置综合地下城手册！提供全副本概览、首领掉落全景表、副本任务指引与野外探索手册，**原生全中文支持**。 |
| **Bagnon (经典背包整合)** | `Bagnon` | `v12.1.8 (官方中文版)` | 无限服 / 经典 / 正式服 | 经典全能背包整合神器！合并背包/银行/公会银行窗口，支持离线查看其他角色库存、快速搜索与高亮分类，**内置官方简体中文**。 |
| **Lueur (任务品与交互标记加强)** | `Lueur` | `v1.4.0 (汉化增强版)` | 无限服 / 经典怀旧 | 基于软目标交互（Soft-Targeting）的高亮神器！接近矿脉、草药、任务物、宝箱与鱼漂时呈现光圈与光柱提示，支持小地图专属图标与双采交替追踪。 |
| **Questie Forever (全知地图任务雷达)** | `Questie` | `v12.6.4 + DB v1.0.13 (中文版)` | 无限服 / 经典怀旧 | 无限服与怀旧服必装的全知任务地图雷达（内置 QuestieDB 无限服离线库），自动隐藏已完成任务与未解锁前置任务，精准标注可接任务与怪物掉落。 |
| **BtWQuests (任务链与前置流程图)** | `BtWQuests` | `v2.69.1 (Forever 中文版)` | 无限服 / 经典 / 正式服 | 可视化任务链与前置条件追溯神器！以科技树流程图形式清晰展示所有主支线前后置关系，自动同步角色实际进度将已完成任务打钩。 |
| **Forever Mouse Tooltip (轻量鼠标提示跟随)** | `ForeverMouseTooltip` | `v0.2.0 (100%全汉化版)` | 无限服 / 经典 / 正式服 | 专为无限服打造的零延迟鼠标提示（HUD/Tooltip）跟随插件！通过原生引擎锚点告别右下角固定位置与残影延迟，支持方位/偏移/缩放/战斗切换与显示 ID。 |
| **TinyTooltip Forever (全能鼠标提示美化与跟随)** | `TinyTooltip` | `v1.1.1 (Forever 全汉化版)` | 无限服 / 经典 / 正式服 | 经典全能鼠标提示增强插件的无限服专版！开箱默认开启提示框跟随鼠标右侧，支持职业染色、生命条美化、3D角色模型与 DIY 拖拽排版。 |

---

## 📖 使用指南（三种模式任选）

### 模式一：免设置直接下载插件（零配置 · 全浏览器通用）
1. 打开网页首页，下方直接展示 **「精选插件市场」**。
2. 无需连接或设置任何本地文件夹，直接点击对应插件卡片右下角的 **「直接下载 ZIP」** 按钮。
3. 将下载好的 `.zip` 压缩包手动解压到魔兽世界的 `Interface/AddOns` 目录下即可进入游戏使用。

### 模式二：浏览器直连管理（免安装客户端 · 一键自动解压）
1. 使用 **Chrome / Edge / Brave** 浏览器打开网页，点击 **「连接本地 AddOns 目录」**。
2. 选择你的魔兽世界插件目录（即使选择游戏根目录或 `_retail_` / `_classic_`，网页也会智能寻址到 `Interface/AddOns`）。
3. 授权后即可在 **「精选插件市场」** 点击 **「一键安装」** 自动下载并解压写入本地，或在 **「已装插件」** 标签页查看 `.toc` 详情、搜索过滤及一键卸载。

### 模式三：Windows / macOS 原生客户端（突破系统盘权限限制 · 自动发现游戏）
- 如果你的魔兽世界安装在 `C:\Program Files (x86)` 等受浏览器沙箱拦截的系统保护目录，或者你使用的是 **macOS (Safari)**：
  1. 在首页点击下载 **Windows 客户端（单文件绿色免安装 `.exe`）** 或 **macOS 客户端（`.dmg`）**。
  2. 运行客户端后，程序会自动扫描本机已安装的魔兽世界路径，并实时检测正在运行的游戏版本，点击 **「一键载入」** 即可畅通无阻地读写与安装插件。

---

## 🛠️ 技术栈与项目结构

- **前端框架**：React 19 + TypeScript + Vite 6
- **样式与图标**：Tailwind CSS v4 + Lucide Icons
- **浏览器端文件与存储**：
  - W3C File System Access API (`window.showDirectoryPicker`, `FileSystemDirectoryHandle`)
  - IndexedDB (`idb-keyval` 持久化保存目录授权句柄)
  - `JSZip`（浏览器内存流式解压缩与多目录识别写入）
- **原生桌面端与本地桥接**：
  - `src-tauri/`：Tauri 2.0 跨平台桌面端（内嵌原生 Rust IPC 指令：目录扫描、ZIP 解压安装、系统对话框、进程检测）
  - `agent/`：基于 Rust (`axum`) 的轻量本地桥接助手服务（监听 `127.0.0.1:24642`）
- **边缘部署**：Cloudflare Pages + Pages Functions (`functions/api/proxy.ts`)

---

## 🚀 本地开发与构建

### 环境要求
- Node.js 18+ 或 20+
- Rust 工具链（仅在需要本地编译 Tauri 桌面端或 `agent` 时需要）

### 启动 Web 前端开发
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

### 构建生产环境静态包
```bash
npm run build
```
构建产物将输出至 `dist/` 目录（包含 `public/addons/` 下的所有精选插件 `.zip` 包）。

### 构建 Tauri 原生桌面客户端（可选）
```bash
npm run tauri build
```

---

## ☁️ 部署到 Cloudflare Pages

本项目可免费部署于 Cloudflare Pages，享受全球 CDN 加速与免费 HTTPS：

1. 将代码推送到 GitHub 仓库。
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers 与 Pages** → **创建应用程序** → **Pages** → **连接到 Git**。
3. 配置构建参数：
   - **框架预设 (Framework preset)**：`Vite`
   - **构建命令 (Build command)**：`npm run build`
   - **构建输出目录 (Build output directory)**：`dist`
4. 点击 **保存并部署** 即可上线。

---

## 🤝 开源协议

本项目基于 [MIT License](LICENSE) 开源，欢迎提交 Issue 和 Pull Request！
