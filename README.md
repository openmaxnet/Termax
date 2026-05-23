<p align="center">
  <img src="src/assets/app-ico.png" width="100" alt="Termax Logo">
</p>

<h1 align="center">Termax</h1>

<p align="center">
  现代化的 SSH 终端客户端，基于 Tauri v2 构建
</p>

<p align="center">
  <a href="./README.en.md">English</a> · 中文
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-v2-blue?logo=tauri" alt="Tauri">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React">
  <img src="https://img.shields.io/badge/Rust-1.85-orange?logo=rust" alt="Rust">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

---

## 功能特性

- **SSH 连接** — 密码认证 / 密钥认证
- **多 Tab 终端** — 拖拽排序、右键菜单、一键重连
- **SFTP 文件浏览器** — 上传 / 下载 / 分块传输进度 / 传输历史 / 取消传输
- **本地终端** — Windows / macOS / Linux 本地 Shell + WSL 支持
- **分屏** — 水平 / 垂直分屏，灵活切换
- **广播输入** — 选择多个终端，同步发送键盘输入
- **系统监控** — CPU / 内存 / 磁盘实时指标
- **主题系统** — Termax Dark / Light、One Dark、Dracula，支持自定义扩展
- **国际化** — 中文 / English
- **应用内更新** — 基于 GitHub Releases 的版本检测与更新

**即将推出：**

- 端口转发（本地 / 远程 / 动态）
- SSH Agent 转发
- 堡垒机 / 跳板机
- 命令片段
- Android 移动端适配

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Tailwind CSS v4 + Zustand + xterm.js |
| 后端 | Rust + Tauri v2 + russh + tokio |
| 构建 | Vite 8 + pnpm + GitHub Actions |

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/) >= 1.85
- [pnpm](https://pnpm.io/) >= 9

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

### 构建

```bash
# 构建前端 + Tauri 应用
pnpm build

# 仅构建前端
pnpm preview
```

## 下载安装

从 [GitHub Releases](https://github.com/termax/termax/releases) 下载最新版本：

| 平台 | 格式 |
|------|------|
| Windows | `.exe` 安装包 |
| macOS | `.dmg` |
| Linux | `.deb` / `.AppImage` |

## 项目结构

```
Termax/
├── src-tauri/                # Rust 后端
│   ├── src/
│   │   ├── commands/         # Tauri IPC 命令（薄层）
│   │   ├── ssh/              # SSH 业务逻辑
│   │   ├── sftp/             # SFTP 文件操作
│   │   ├── local/            # 本地终端 PTY
│   │   ├── monitor/          # 系统监控
│   │   └── storage/          # 持久化存储
│   └── Cargo.toml
├── src/                      # React 前端
│   ├── app/                  # 应用外壳（TitleBar / Sidebar / StatusBar）
│   ├── features/             # 功能模块
│   │   ├── terminal/         # 终端
│   │   ├── connection/       # 连接管理
│   │   ├── sftp/             # SFTP 文件浏览器
│   │   ├── monitoring/       # 系统监控
│   │   └── settings/         # 设置
│   ├── ui/                   # 通用 UI 组件库（T 前缀）
│   ├── hooks/                # 通用 Hooks
│   ├── stores/               # Zustand 状态管理
│   ├── lib/                  # 工具函数 + IPC 接口层
│   ├── i18n/                 # 国际化
│   └── themes/               # 终端配色方案
├── .github/workflows/        # GitHub Actions CI/CD
└── package.json
```

## 开发指南

### Git 提交规范

```
<type>(<scope>): <简短中文描述>

类型: feat | fix | refactor | style | docs | test | chore
范围: rust | ui | tauri | config

示例:
  feat(rust): 添加 SSH 密钥认证支持
  fix(ui): 修复终端 resize 时 IME 输入中断的问题
```

### 代码规范

- 详见 [CLAUDE.md](./CLAUDE.md) 中的完整编码规范
- CSS 变量使用 `--tx-` 前缀
- 通用 UI 组件使用 `T` 前缀，放在 `src/ui/`
- IPC 调用通过 `ipc` 对象，不直接调用 `invoke()`

## 许可证

[MIT License](./LICENSE)
