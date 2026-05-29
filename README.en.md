<p align="center">
  <img src="src/assets/app-ico.png" width="100" alt="Termax Logo">
</p>

<h1 align="center">Termax</h1>

<p align="center">
  A modern SSH terminal client built with Tauri v2
</p>

<p align="center">
  中文 · <a href="./README.md">English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-v2-blue?logo=tauri" alt="Tauri">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React">
  <img src="https://img.shields.io/badge/Rust-1.85-orange?logo=rust" alt="Rust">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

<p align="center">
  <img src=".github/asset/home.png" width="720" alt="Termax Screenshot">
</p>

---

## Features

- **SSH Connections** — Password / Key authentication
- **SSH Credential Management** — AES-256-GCM encrypted storage, unified key & password management
- **Bastion Host / Jump Host** — Proxy connections through jump servers
- **Port Forwarding** — Local / Remote / Dynamic port forwarding
- **Multi-Tab Terminal** — Drag-to-reorder, context menu, one-click reconnect
- **SFTP File Browser** — Upload / Download / Chunked transfer with progress / Transfer history / Cancel
- **Local Terminal** — Windows / macOS / Linux local Shell + WSL support
- **Split Pane** — Horizontal / Vertical split, flexible switching
- **Broadcast Input** — Select multiple terminals and sync keyboard input
- **System Monitoring** — Real-time CPU / Memory / Disk metrics
- **Debug Panel** — IPC call timing, FPS / Memory metrics, structured log export
- **Theme System** — Termax Dark / Light, One Dark, Dracula, extensible
- **Internationalization** — 中文 / English
- **In-App Updates** — Version detection via GitHub Releases

**Coming Soon:**

- Command Snippets
- Android Mobile Support

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Tailwind CSS v4 + Zustand + xterm.js |
| Backend | Rust + Tauri v2 + russh + tokio |
| Build | Vite 8 + pnpm + GitHub Actions |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/) >= 1.85
- [pnpm](https://pnpm.io/) >= 9

### Install Dependencies

```bash
pnpm install
```

### Development & Build Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev mode (hot reload) |
| `pnpm build` | Build frontend (type check + Vite bundle) |
| `pnpm build:nsis` | Build Windows NSIS installer (`.exe`) |
| `pnpm build:msi` | Build Windows MSI installer |
| `pnpm build:portable` | Build Windows portable (no installer) |
| `pnpm lint` | ESLint code check |
| `pnpm gen:installer-assets` | Generate installer bitmap assets |

## Download

Download the latest release from [GitHub Releases](https://github.com/openmaxnet/Termax/releases):

| Platform | Format | Status |
|----------|--------|--------|
| Windows | `.exe` installer / Portable | ✅ Supported |
| macOS | `.dmg` | 🚧 Coming soon |
| Linux | `.deb` / `.AppImage` | 🚧 Coming soon |

## Project Structure

```
Termax/
├── src-tauri/                # Rust backend
│   ├── src/
│   │   ├── commands/         # Tauri IPC commands (thin layer)
│   │   ├── ssh/              # SSH business logic
│   │   ├── sftp/             # SFTP file operations
│   │   ├── local/            # Local terminal PTY
│   │   ├── monitor/          # System monitoring
│   │   └── storage/          # Persistent storage (SQLite)
│   └── Cargo.toml
├── src/                      # React frontend
│   ├── app/                  # App shell (TitleBar / Sidebar / StatusBar)
│   ├── features/             # Feature modules
│   │   ├── terminal/         # Terminal
│   │   ├── connection/       # Connection management
│   │   ├── credential/       # SSH credential management
│   │   ├── sftp/             # SFTP file browser
│   │   ├── monitoring/       # System monitoring
│   │   └── settings/         # Settings
│   ├── ui/                   # Reusable UI components (T prefix)
│   ├── hooks/                # Reusable Hooks
│   ├── stores/               # Zustand state management
│   ├── lib/                  # Utilities + IPC interface layer
│   ├── i18n/                 # Internationalization
│   └── themes/               # Terminal color schemes
├── .github/workflows/        # GitHub Actions CI/CD
└── package.json
```

## Development Guide

### Code Standards

- See [CLAUDE.md](./CLAUDE.md) for the full coding standards
- CSS variables use the `--tx-` prefix
- Reusable UI components use the `T` prefix, placed in `src/ui/`
- IPC calls go through the `ipc` object, never call `invoke()` directly

## License

[MIT License](./LICENSE)
