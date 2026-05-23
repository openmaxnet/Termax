# Termax 项目编码规范

> 适用范围：Termax SSH 终端客户端（Tauri v2 + Rust + React 19 + TypeScript + Zustand + Tailwind CSS v4）
> 核心原则：不影响现有功能、遵循最佳实践、良好的扩展性、中文注释、单一职责

---

## 目录

1. [通用规范](#1-通用规范)
   - 1.1 [统一命名体系](#11-统一命名体系)
   - 1.2 [注释规范](#12-注释规范)
   - 1.3 [重复代码抽取原则](#13-重复代码抽取原则)
   - 1.4 [单一职责与扩展性](#14-单一职责与扩展性)
2. [Rust 后端规范](#2-rust-后端规范)
3. [TypeScript / React 前端规范](#3-typescript--react-前端规范)
4. [可复用组件库 (ui/)](#4-可复用组件库-ui)
5. [可复用 Hooks 库 (hooks/)](#5-可复用-hooks-库-hooks)
6. [Tauri IPC 通信规范](#6-tauri-ipc-通信规范)
7. [状态管理规范](#7-状态管理规范)
8. [国际化 (i18n) 规范](#8-国际化-i18n-规范)
9. [样式规范](#9-样式规范)
10. [测试规范](#10-测试规范)
11. [Git 提交规范](#11-git-提交规范)
12. [新功能开发 Checklist](#12-新功能开发-checklist)

---

## 1. 通用规范

### 1.1 统一命名体系

所有命名遵循**前缀统一**原则，确保项目内命名一致、避免外部库冲突。

#### 1.1.1 CSS 变量前缀：`--tx-`

所有 CSS 设计令牌（Design Token）使用 `--tx-` 作为命名空间前缀，格式为 `--tx-{类别}-{层级}`：

```css
/* ═══ 背景层级 ═══ */
--tx-bg-base          /* 最底层页面背景 */
--tx-bg-surface       /* 面板/侧边栏背景 */
--tx-bg-elevated      /* 弹出层背景（弹窗、下拉菜单、工具提示） */
--tx-bg-hover         /* 悬停态背景 */
--tx-bg-active        /* 激活态背景 */
--tx-bg-overlay       /* 遮罩层背景（rgba） */

/* ═══ 文本层级 ═══ */
--tx-text-primary     /* 主要文本（最高对比度） */
--tx-text-secondary   /* 次要文本（中等对比度） */
--tx-text-tertiary    /* 辅助文本（低对比度） */
--tx-text-inverse     /* 反转文本（深色背景上的浅色文字） */
--tx-text-link        /* 链接文本 */

/* ═══ 强调色 ═══ */
--tx-accent-default   /* 默认强调色 */
--tx-accent-hover     /* 悬停强调色 */
--tx-accent-muted     /* 淡化强调色（选中背景等） */

/* ═══ 边框 ═══ */
--tx-border-light     /* 浅边框（分隔线、面板边框） */
--tx-border-default   /* 默认边框（输入框、按钮边框） */
--tx-border-focus     /* 焦点边框（focus ring） */

/* ═══ 语义色 ═══ */
--tx-green            /* 成功/已连接 */
--tx-green-bg         /* 成功背景 */
--tx-red              /* 错误/断开 */
--tx-red-bg           /* 错误背景 */
--tx-yellow           /* 警告/连接中 */

/* ═══ 阴影 ═══ */
--tx-shadow-sm        /* 小阴影（按钮、卡片） */
--tx-shadow-md        /* 中阴影（弹窗、下拉菜单） */
--tx-shadow-lg        /* 大阴影（模态框） */

/* ═══ 排版 ═══ */
--tx-font-sans        /* UI 无衬线字体栈 */
--tx-font-mono        /* 终端等宽字体栈 */
--tx-font-size-xs     /* 11px */
--tx-font-size-sm     /* 12px */
--tx-font-size-base   /* 13px */
--tx-font-size-lg     /* 14px */

/* ═══ 间距 ═══ */
--tx-space-1          /* 4px */
--tx-space-2          /* 8px */
--tx-space-3          /* 12px */
--tx-space-4          /* 16px */

/* ═══ 圆角 ═══ */
--tx-radius-sm        /* 4px */
--tx-radius-md        /* 6px */
--tx-radius-lg        /* 8px */
```

**规则：**
- CSS 变量**必须**使用 `--tx-` 前缀，禁止裸名（如 `--bg-base`）
- 新增变量在 `src/index.css` 的 `:root` 和 `.dark` 中同步定义
- 引用时使用 `var(--tx-xxx)` 语法，不允许硬编码颜色值
- 动画命名使用 `@keyframes tx-xxx` 格式（如 `tx-fade-in`、`tx-scale-in`）

#### 1.1.2 前端组件前缀：`T`

所有可复用的通用 UI 组件使用 `T` 前缀：

| 组件            | 用途                     |
|----------------|-------------------------|
| `TButton`      | 通用按钮（含 variant）     |
| `TIconButton`  | 图标按钮（含 tooltip 延迟）  |
| `TConfirm`     | 确认对话框                 |
| `TContextMenu` | 右键上下文菜单              |
| `TDropdown`    | 下拉菜单弹出层              |
| `TEmpty`       | 空状态占位                 |
| `TSelect`      | 自定义下拉选择器            |
| `TSplitPane`   | 通用分屏容器                |
| `TTip`         | 工具提示气泡                |
| `TSplash`      | 启动画面                   |

**规则：**
- 通用 UI 组件**必须**放在 `src/ui/` 目录
- 通用 UI 组件**必须**使用 `T` 前缀命名文件和导出名
- 应用外壳组件（`AppLayout`、`TitleBar` 等）放在 `src/app/` 目录，**不使用** `T` 前缀
- 功能模块组件（`TerminalTab`、`FileBrowser` 等）放在 `src/features/{domain}/` 目录，**不使用** `T` 前缀
- Hook 文件使用 `use` 前缀，Store 文件使用 `Store` 后缀，**不使用** `T` 前缀

#### 1.1.3 IPC 方法前缀：领域_动作

| 领域       | Rust 命令前缀 | 前端 ipc 方法前缀 | 示例                                  |
|-----------|-------------|-----------------|--------------------------------------|
| SSH 连接   | `ssh_`      | `ssh` + 动词     | `connect_ssh` → `ipc.sshConnect()`   |
| SFTP      | `sftp_`     | `sftp` + 动词    | `sftp_list_files` → `ipc.sftpListFiles()` |
| 本地终端   | `local_`    | `local` + 动词   | `connect_local` → `ipc.localConnect()` |
| 连接配置   | `config_`   | `config` + 动词  | `save_config` → `ipc.configSave()`   |
| 系统监控   | `monitor_`  | `monitor` + 动词 | `monitor_fetch` → `ipc.monitorFetch()` |
| SFTP 编辑  | `sftp_edit_`| `sftpEdit` + 动词| `sftp_start_edit` → `ipc.sftpEditStart()` |

**规则：**
- Rust 命令名：`{领域}_{动作}`，全 snake_case（如 `sftp_upload_file`）
- 前端 `ipc` 对象按**功能域分组**，方法名使用 camelCase（如 `ipc.sftp.uploadFile()`）
- 事件名：`{领域}-{动作}`，全 kebab-case（如 `term-output`、`session-ready`）

#### 1.1.4 事件名规范

```
领域-动作
 └──┘ └──┘
  │     └─ 具体动作（output, ready, error, uploaded）
  └─────── 功能领域（term, session, sftp-edit）

完整事件列表：
  term-output         ← 终端数据输出
  session-ready       ← 会话认证完成、shell 就绪
  session-error       ← 会话错误（断开、认证失败等）
  sftp-edit-uploaded  ← SFTP 编辑自动上传完成
```

#### 1.1.5 通用命名速查表

| 语言   | 类型               | 约定              | 示例                              |
|--------|-------------------|-------------------|-----------------------------------|
| Rust   | 模块/文件          | snake_case        | `ssh_cmd.rs`, `connection_config` |
| Rust   | 类型/结构体/枚举    | PascalCase        | `AppError`, `SessionHandle`       |
| Rust   | 函数/方法          | snake_case        | `spawn_session`, `connect_ssh`    |
| Rust   | 常量              | UPPER_SNAKE       | `CONFIG_FILE`                     |
| Rust   | Cargo crate       | snake_case        | `termax-core`, `termax-ssh`       |
| TS     | 组件文件           | PascalCase.tsx    | `TerminalTab.tsx`, `TButton.tsx`  |
| TS     | Hook 文件          | use + PascalCase  | `useTerminal.ts`, `useClickOutside.ts` |
| TS     | Store 文件         | 名词 + Store.ts   | `terminalStore.ts`, `settingsStore.ts` |
| TS     | 工具库文件          | camelCase.ts      | `ipc.ts`, `utils.ts`              |
| TS     | 类型定义文件        | 领域 + .ts        | `types.ts`（或在使用的文件中定义）   |
| TS     | 组件导出名          | PascalCase        | `TerminalTab`, `TConfirm`         |
| TS     | Hook 导出名         | usePascalCase     | `useTerminal`, `useClickOutside`  |
| TS     | Store 导出名        | usePascalCaseStore| `useTerminalStore`                |
| TS     | 工具函数            | camelCase         | `getMessage`, `cn`                |
| TS     | 类型/接口           | PascalCase        | `ConnectionConfig`, `TabInfo`     |
| TS     | 字面量联合类型       | PascalCase        | `AppTheme`, `CursorStyle`         |
| Tauri   | 命令名             | snake_case        | `connect_ssh`, `sftp_list_files`  |
| Tauri   | 事件名             | kebab-case        | `term-output`, `session-ready`    |
| Tauri   | 窗口 label          | kebab-case        | `sftp-standalone`                 |
| CSS     | 变量               | --tx-{类别}-{层级} | `--tx-bg-elevated`               |
| CSS     | 动画               | tx-{描述}         | `@keyframes tx-fade-in`           |
| CSS     | 类名               | Tailwind 或 kebab  | `hide-scrollbar`（工具类）         |

---

### 1.2 注释规范

- 所有注释使用**中文**，清晰说明意图和原因（Why），而非重复代码做什么（What）
- 公共 API / 导出函数需要注释说明用途、参数和返回值
- 复杂逻辑需要注释解释原因，特别是非显而易见的算法或边界条件
- 临时解决方案（workaround）必须标注 `TODO` 或 `FIXME` 并说明原因

```rust
// 通过 channel 向 session 任务发送关闭指令
// 注意：这里不等待响应，因为任务可能已经处于不可恢复的错误状态
handle.cmd_tx.send(SessionCmd::Close);
```

```typescript
// 延迟 50ms 确保容器已完成布局计算再执行 fit
// 避免 xterm.js 在容器尺寸为 0 时计算错误的行列数
setTimeout(() => { fitRef.current?.fit(); termRef.current?.focus(); }, 50);
```

---

### 1.3 重复代码抽取原则

**核心原则：出现第三次时抽取。**

| 出现次数 | 处理方式                                                  |
|---------|----------------------------------------------------------|
| 第 1 次  | 直接编写                                                  |
| 第 2 次  | 允许重复，但标注 `// TODO: 抽取为公共 xxx`                    |
| 第 3 次  | **必须抽取**到对应的共享层（`ui/`、`hooks/`、`lib/utils.ts`） |

#### 当前已识别的重复模式

| 重复模式                     | 状态 | 已抽取至                 |
|----------------------------|------|--------------------------|
| 按钮 + 延迟 Tooltip          | ✅ 已抽取 | `ui/TIconButton.tsx`     |
| 点击外部关闭                  | ✅ 已抽取 | `hooks/useClickOutside.ts` |
| 视口位置钳制                  | ✅ 已抽取 | `lib/utils.ts → clampToViewport()` |
| 延迟显示（400ms tooltip）     | ✅ 已抽取 | `hooks/useDelayedShow.ts` |
| 确认弹窗                     | ✅ 已抽取 | `ui/TConfirm.tsx`        |
| 下拉菜单弹出定位              | ✅ 已抽取 | `ui/TDropdown.tsx`       |
| 鼠标悬停态                   | ⏳ 待观察（2 处重复） | `hooks/useHover.ts`（出现第 3 处时抽取） |

#### 抽取优先级

1. **已完成**：延迟 Tooltip 按钮（`TIconButton`）、点击外部关闭（`useClickOutside`）、视口位置钳制（`clampToViewport`）、下拉菜单容器（`TDropdown`）
2. **待观察**：悬停态（`useHover`，当前 2 处重复，出现第 3 处时抽取）

---

### 1.4 单一职责与扩展性

- **每个文件只做一件事**：一个模块负责一类功能
- **函数保持简短**：单个函数不超过 80 行（特殊情况需注释说明）
- **组件拆分**：React 组件超过 300 行必须拆分为子组件/Hook/工具函数
- **模块边界清晰**：Rust module 之间通过明确的公开接口交互
- **接口抽象**：新增功能优先考虑接口抽象而非硬编码（如认证方式用 enum 而非 if-else）
- **配置驱动**：终端配色、字体、快捷键等通过配置定义，不硬编码到组件中
- **YAGNI 原则**：预留必要的扩展点但不提前实现不用的功能

---

## 2. Rust 后端规范

### 2.1 项目结构

```
src-tauri/src/
├── main.rs              # 入口 —— 仅调用 lib::run()
├── lib.rs               # Tauri 应用组装 —— 插件注册、状态注入、命令注册
├── error.rs             # 统一错误类型 AppError 和 CmdResult 别名
├── commands/            # Tauri IPC 命令处理器（薄层，不含业务逻辑）
│   ├── mod.rs
│   ├── ssh_cmd.rs       # SSH 相关命令（connect/disconnect/sendInput/resize/test）
│   ├── sftp_cmd.rs      # SFTP 相关命令（list/read/write/delete/rename/upload/download）
│   ├── config_cmd.rs    # 连接配置 CRUD
│   ├── local_cmd.rs     # 本地终端命令
│   ├── monitor_cmd.rs   # 系统监控命令
│   └── edit_cmd.rs      # SFTP 远程编辑命令
├── ssh/                 # SSH 业务逻辑层
│   ├── mod.rs
│   ├── client.rs        # SSH 连接生命周期（spawn_session → run_session → I/O loop）
│   ├── channel.rs       # SessionCmd 枚举和 SessionHandle 结构体
│   └── config.rs        # ConnectionConfig 和 AuthMethod 定义（与前端共享契约）
├── sftp/                # SFTP 业务逻辑层
│   ├── mod.rs
│   ├── client.rs        # SFTP 客户端操作函数
│   └── editor.rs        # 远程编辑会话管理（下载 → 监控 → 自动上传）
├── local/               # 本地终端层
│   ├── mod.rs
│   └── pty.rs           # portable-pty 实现（跨平台 shell 检测和 PTY 生成）
├── monitor/             # 系统监控层
│   ├── mod.rs
│   ├── client.rs        # 通过 SSH 采集系统指标
│   └── parser.rs        # Linux /proc 文件系统解析器
├── session/             # 会话管理（M2 规划中）
│   ├── mod.rs
│   ├── manager.rs       # 会话生命周期管理器
│   └── pool.rs          # SSH 连接池
└── storage/             # 持久化存储层
    ├── mod.rs
    └── store.rs         # JSON 文件存储（configs.json CRUD）
```

### 2.2 分层架构

```
┌─────────────────────────────────┐
│  commands/                      │  ← 薄命令层：参数校验、状态查询、调用业务层（≤50行）
├─────────────────────────────────┤
│  ssh/  sftp/  local/  monitor/  │  ← 业务逻辑层：协议实现、连接管理、数据解析
├─────────────────────────────────┤
│  storage/                       │  ← 持久化层：文件读写、序列化
├─────────────────────────────────┤
│  error.rs                       │  ← 横切关注点：统一错误类型
└─────────────────────────────────┘
```

**规则：**
- `commands/` 层只做参数解包和调用业务层，每个命令函数不超过 50 行
- 业务逻辑全部在业务层实现，命令层不包含 SSH/SFTP 协议细节
- 业务层不依赖 Tauri 框架类型（`AppHandle`、`State` 等），使用标准 Rust 类型
- 业务层与命令层通过错误类型转换对接

### 2.3 错误处理

```rust
// error.rs —— 统一错误类型，所有 Tauri 命令返回 CmdResult<T>
#[derive(Error, Debug, Serialize)]
pub enum AppError {
    #[error("SSH 连接失败: {0}")]
    SshError(String),
    #[error("认证失败")]
    AuthFailed,
    #[error("会话未找到: {0}")]
    SessionNotFound(String),
    #[error("SFTP 错误: {0}")]
    SftpError(String),
    #[error("IO 错误: {0}")]
    Io(String),
    #[error("监控错误: {0}")]
    MonitorError(String),
    #[error("内部错误: {0}")]
    Internal(String),
}

pub type CmdResult<T> = Result<T, AppError>;
```

**规则：**
- 所有 `#[tauri::command]` 函数返回 `CmdResult<T>`
- 新增错误变种时，优先复用已有变种，仅在语义完全不同时新增
- 错误信息对用户友好（中文），不暴露内部调用栈
- 使用 `From` trait 批量转换外部库错误，避免散落的 `map_err`

```rust
// 好的做法：集中定义 From 转换
impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self { AppError::Io(e.to_string()) }
}
```

### 2.4 异步规范

- 所有 SSH / SFTP / PTY 连接使用 `tokio::spawn` 在独立任务中运行
- Session 内部通信使用 `tokio::sync::mpsc::unbounded_channel`
- 命令函数使用 `async`，但不在内部做长时间阻塞操作
- `tokio::select!` 同时监听 channel 消息和 SSH 数据，任一退出时自动清理

```rust
// 标准 session I/O 循环模式
loop {
    tokio::select! {
        Some(cmd) = cmd_rx.recv() => {
            match cmd {
                SessionCmd::Input(data) => { /* 写入 SSH channel */ }
                SessionCmd::Resize { cols, rows } => { /* 调整窗口大小 */ }
                SessionCmd::Close => break,
            }
        }
        msg = channel.wait() => {
            match msg {
                Some(ChannelMsg::Data { data }) => { /* 发送 term-output 事件 */ }
                Some(ChannelMsg::Close) | None => break,
                _ => {}
            }
        }
    }
}
```

### 2.5 状态管理

```rust
// 使用 Mutex<HashMap<String, Handle>> 管理多个并发会话
pub struct AppState {
    pub sessions: Mutex<HashMap<String, SessionHandle>>,
}

// 规则：
// 1. 锁持有时间尽可能短 —— 获取 handle 后立即释放锁
// 2. 绝对不要在持有锁时调用 .await（会导致死锁）
// 3. 使用 uuid::Uuid::new_v4() 作为 session ID
```

### 2.6 存储规范

- 使用 `dirs::data_dir()` 获取平台数据目录，子目录为 `Termax/`
- CRUD 遵循"加载→修改→保存"模式，保存失败不影响已加载的数据
- 文件名和路径作为模块级 `const` 定义
- 序列化使用 `serde_json`，生产配置使用 `to_string_pretty`

### 2.7 Rust 代码风格

```rust
// 导入顺序：std → 第三方库 → crate 模块（每组之间空行分隔）
use std::collections::HashMap;
use std::sync::Mutex;

use russh::client;
use tauri::Emitter;
use tokio::sync::mpsc;

use crate::error::AppError;
use crate::ssh::config::ConnectionConfig;

// 模块声明在文件顶部
mod commands;
mod error;
mod ssh;
```

---

## 3. TypeScript / React 前端规范

### 3.1 项目结构

> Import 使用 `@/` 路径别名（配置在 `tsconfig.app.json` 的 `paths` + `vite.config.ts` 的 `resolve.alias`），禁止使用 `../../` 跨目录相对路径。同目录内的引用保持相对路径。

```
src/
├── main.tsx                 # 入口 —— 渲染 <App/>，导入全局样式
├── App.tsx                  # 根组件 —— 主题同步、窗口管理、路由分发
├── index.css                # 全局样式 —— --tx-* CSS 变量、重置、动画
│
├── app/                     # 应用外壳 — 始终可见的框架组件
│   ├── AppLayout.tsx        # 主编排器 — 分屏、弹窗、连接生命周期
│   ├── TitleBar.tsx         # 标题栏 — 窗口控制、标签页管理、分屏菜单
│   ├── Sidebar.tsx          # 侧边栏 — 连接树浏览与管理
│   ├── StatusBar.tsx        # 状态栏 — 系统监控指标展示
│   └── MainArea.tsx         # 主区域 — 根据 tab.type 路由到终端/SFTP/空状态
│
├── features/                # 功能模块 — 每个自包含
│   ├── terminal/            # 终端
│   │   ├── Terminal.tsx     # xterm.js 初始化和配置
│   │   ├── TerminalTab.tsx  # 终端标签页 UI（工具栏、搜索、设置）
│   │   ├── useTerminalConnection.ts  # SSH/本地终端生命周期 Hook
│   │   └── useSplitManager.ts        # 分屏管理 Hook
│   ├── connection/          # 连接管理
│   │   ├── ConnectionManager.tsx      # 连接 CRUD 对话框
│   │   ├── ConnectionForm.tsx         # 连接表单（SSH/密钥认证）
│   │   ├── ConnectionTree.tsx         # 连接树形列表
│   │   └── QuickPanel.tsx             # 快速连接面板
│   ├── sftp/                # SFTP 文件管理
│   │   ├── SftpWindow.tsx   # SFTP 独立窗口
│   │   ├── FileBrowser.tsx  # 文件浏览器主组件
│   │   ├── SftpFileList.tsx # 文件列表
│   │   ├── SftpBreadcrumb.tsx         # 路径面包屑
│   │   ├── SftpDeleteDialog.tsx       # 删除确认对话框
│   │   ├── SftpViews.tsx    # 视图切换
│   │   ├── sftpMenuItems.ts           # 右键菜单项构建（非组件，纯函数）
│   │   └── utils.ts         # SFTP 格式化工具
│   ├── monitoring/          # 系统监控
│   │   ├── MonitorOverlay.tsx         # 监控浮动面板
│   │   ├── MonitoringPanels.tsx       # 面板聚合导出（re-export）
│   │   ├── OverviewPanel.tsx          # 概览面板 + 骨架屏 + 磁盘行
│   │   ├── ProcessesPanel.tsx         # 进程列表面板（排序/右键菜单/kill）
│   │   ├── FullView.tsx     # 全量视图
│   │   ├── ThumbnailView.tsx          # 缩略视图
│   │   ├── CpuGauge.tsx     # CPU 仪表盘
│   │   ├── MemoryBar.tsx    # 内存条
│   │   ├── MetricCard.tsx   # 指标卡片
│   │   └── useMonitorPolling.ts       # 监控数据轮询 Hook
│   └── settings/            # 设置
│       ├── SettingsDialog.tsx         # 设置对话框
│       └── SettingsPanels.tsx         # 设置面板集合
│
├── ui/                      # 通用 UI 组件库 — 所有以 T 前缀命名的可复用组件
│   ├── TSplitPane.tsx       # 通用分屏容器
│   ├── TButton.tsx          # 通用按钮
│   ├── TIconButton.tsx      # 图标按钮（内置延迟 Tooltip）
│   ├── TConfirm.tsx         # 确认对话框
│   ├── TContextMenu.tsx     # 右键上下文菜单
│   ├── TDropdown.tsx        # 下拉菜单容器（自动视口定位 + 点击外部关闭）
│   ├── TEmpty.tsx           # 空状态占位
│   ├── TSelect.tsx          # 下拉选择器
│   ├── TSplash.tsx          # 启动/闲置画面
│   └── TTip.tsx             # 工具提示气泡（HOC 模式，包裹子元素）
│
├── hooks/                   # 通用 Hooks（任何模块都可用）
│   ├── useClickOutside.ts   # 点击元素外部时触发回调
│   ├── useDelayedShow.ts    # 延迟显示（tooltip 400ms 模式）
│   └── useFloatWindow.ts    # 浮动窗口拖拽/缩放
│
├── stores/                  # Zustand 状态管理
│   ├── sessionStore.ts      # 会话元数据
│   ├── terminalStore.ts     # 标签页状态
│   └── settingsStore.ts     # 持久化用户设置
│
├── lib/                     # 基础设施
│   ├── ipc/                 # Tauri IPC 接口层（按领域拆分）
│   │   ├── index.ts         # 统一导出 ipc + events + 类型
│   │   ├── types.ts         # 所有接口定义（ConnectionConfig, SystemInfo 等）
│   │   ├── ssh.ts           # SSH 连接/断开/输入/调整大小
│   │   ├── local.ts         # 本地终端连接
│   │   ├── sftp.ts          # SFTP 文件操作 + 远程编辑
│   │   ├── config.ts        # 连接配置 CRUD
│   │   ├── monitor.ts       # 系统监控采集
│   │   └── events.ts        # 事件监听（term-output, session-ready 等）
│   ├── utils.ts             # 通用工具函数（cn, clampToViewport, generateId）
│   ├── fonts.ts             # 系统字体检测
│   └── terminal-themes.ts   # 终端配色方案注册表
│
├── i18n/                    # 国际化
│   ├── index.ts             # 国际化系统（useI18n, getMessage）
│   ├── zh-CN.json           # 中文翻译
│   └── en-US.json           # 英文翻译
│
└── styles/                  # 补充样式（仅在 Tailwind 无法覆盖时使用）
    └── xterm.css            # xterm.js 样式覆盖
```

### 3.2 组件编写规范

#### 内部结构顺序（强制）

```
1. Refs        —— useRef
2. State       —— useState
3. Store       —— useXxxStore(selector)
4. Custom Hooks—— useI18n(), useTerminal(), etc.
5. Effects     —— useEffect（按依赖分组，无依赖的初始化在最前）
6. Callbacks   —— useCallback / 事件处理函数
7. Render      —— return JSX
```

#### 组件模板

> `React.memo(function Xxx() {})` 是 React 推荐的 memo 写法，具名函数让 DevTools 正确显示组件名，无需 `_` 后缀或 `displayName`。
> 泛型组件无法直接用此形式，需保留内部实现函数 + `as typeof` 导出。

```typescript
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useI18n } from '../../i18n';
import { useSettingsStore } from '../../stores/settingsStore';

// Props 接口必须定义并导出
export interface TerminalTabProps {
  tabId: string;
  config: ConnectionConfig | null;
  visible: boolean;
  onSftpConnect?: (config: ConnectionConfig) => void;
}

// React.memo 包裹具名函数组件，DevTools 中显示正确组件名
export const TerminalTab = React.memo(function TerminalTab({
  tabId, config, visible, onSftpConnect,
}: TerminalTabProps) {
  // ── 1. Refs ──
  const containerRef = useRef<HTMLDivElement>(null!);

  // ── 2. State ──
  const [showSearch, setShowSearch] = useState(false);

  // ── 3. Store ──
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setConnected = useTerminalStore((s) => s.setConnected);

  // ── 4. Custom Hooks ──
  const { t } = useI18n();

  // ── 5. Effects ──
  useEffect(() => {
    // 初始化逻辑
    return () => { /* 清理 */ };
  }, []);

  useEffect(() => {
    // 响应配置变化的更新逻辑
  }, [fontSize]);

  // ── 6. Callbacks ──
  const handleSearch = useCallback(() => {
    // ...
  }, [/* deps */]);

  // ── 7. Render ──
  return (
    <div>...</div>
  );
});
```

泛型组件需要保留 `as typeof` 模式：

```typescript
// 泛型组件：声明内部实现函数 + as typeof 导出
function TSelectInner<T extends string>({ value, options, onChange }: TSelectProps<T>) {
  // ...
}
export const TSelect = React.memo(TSelectInner) as typeof TSelectInner;
```

**规则：**
- 每个文件**只导出**一个主要组件
- 子组件/辅助组件可放在同一文件底部，不超过 50 行；超过则拆分到独立文件
- 超过 300 行的组件**必须**拆分（提取子组件、Hook 或工具函数）
- Props 类型定义为 `interface` 并导出（方便其他组件引用）
- 组件导出使用 `React.memo` 包裹

### 3.3 Hook 规范

```typescript
// Hook 以 use 开头，返回对象（非数组），方便按需解构
export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void,
) {
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handler();
      }
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}
```

**规则：**
- 返回值使用对象 `{ a, b }`，调用方可 `const { a } = useXxx()` 按需解构
- 回调参数使用 `useCallback` 包裹
- 必须包含清理逻辑（`useEffect` return）
- Hook 内部不直接操作 Zustand store
- Hook 文件放在 `hooks/` 目录，文件名 `use` + PascalCase

### 3.4 TypeScript 类型规范

```typescript
// 对象类型 → interface
export interface ConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_method: { Password: string } | { Key: { path: string; passphrase?: string } };
  group?: string | null;
}

// 联合类型/简单别名 → type
export type AppTheme = 'dark' | 'light' | 'system';
export type TabType = 'ssh' | 'local' | 'sftp';
```

**规则：**
- 对象结构用 `interface`，联合类型用 `type`
- 可选字段用 `?`，可为 null 的字段显式标注 `| null`
- 禁止使用 `any`，特殊情况用 `unknown` + 类型守卫
- 字符串枚举用字面量联合类型（`'dark' | 'light'`），不使用 TypeScript `enum`

---

## 4. 可复用组件库 (ui/)

### 4.1 组件抽取原则

当一个模式在**3 个或以上**文件中出现时，必须抽取为 `ui/` 中的通用组件。

### 4.2 通用组件接口定义

#### `TIconButton` — 图标按钮（含延迟 Tooltip）

```typescript
interface TIconButtonProps {
  icon: string;                       // Iconify 图标名
  tip?: string;                       // Tooltip 文本（不传则不显示 tooltip）
  size?: 'sm' | 'md';                 // sm=22px, md=30px
  variant?: 'default' | 'window' | 'close'; // default=标准, window=窗口控制, close=关闭按钮
  active?: boolean;                   // 激活态样式
  onClick?: () => void;
  style?: React.CSSProperties;
}
```

#### `TDropdown` — 下拉菜单容器

```typescript
interface TDropdownProps {
  open: boolean;
  anchorEl: HTMLElement | null;       // 锚点元素，用于计算弹出位置
  onClose: () => void;                // 点击外部或 Esc 时关闭
  placement?: 'bottom-start' | 'bottom-end'; // 弹出方向
  children: React.ReactNode;          // 菜单内容
}
```

#### `TTip` — 工具提示（HOC 模式）

```typescript
interface TTipProps {
  text: string;
  delay?: number;                     // 延迟显示毫秒数，默认 400
  children: React.ReactElement;       // 被包裹的单个子元素
}
```

### 4.3 通用 UI 组件清单

| 组件 | 文件 | 用途 | 是否已实现 |
|------|------|------|-----------|
| `TIconButton` | `ui/TIconButton.tsx` | 带延迟 Tooltip 的图标按钮 | ✅ |
| `TConfirm`    | `ui/TConfirm.tsx`    | 确认/取消对话框 | ✅ |
| `TContextMenu`| `ui/TContextMenu.tsx`| 右键上下文菜单 | ✅ |
| `TDropdown`   | `ui/TDropdown.tsx`   | 下拉菜单弹出容器 | ✅ |
| `TEmpty`      | `ui/TEmpty.tsx`      | 空状态占位 | ✅ |
| `TSelect`     | `ui/TSelect.tsx`     | 下拉选择器 | ✅ |
| `TSplitPane`  | `ui/TSplitPane.tsx`  | 通用分屏容器 | ✅ |
| `TTip`        | `ui/TTip.tsx`        | HOC 工具提示气泡 | ✅ |
| `TSplash`     | `ui/TSplash.tsx`     | 应用启动/闲置画面 | ✅ |

---

## 5. 可复用 Hooks 库 (hooks/)

### 5.1 Hook 抽取原则

- `hooks/` 只放**通用 Hook**（任何模块都可能使用的）
- **业务 Hook** 就近放在对应的功能模块目录中（如 `features/terminal/useTerminalConnection.ts`）
- 当一段副作用/状态逻辑在**2 个或以上**文件中出现时，考虑抽取。3 个及以上**必须**抽取

### 5.2 当前通用 Hook

| Hook | 文件 | 用途 |
|------|------|------|
| `useClickOutside` | `hooks/useClickOutside.ts` | 监听点击元素外部，关闭弹出层 |
| `useDelayedShow` | `hooks/useDelayedShow.ts` | 延迟显示（tooltip 400ms 模式） |
| `useFloatWindow` | `hooks/useFloatWindow.ts` | 浮动窗口拖拽/缩放 |

### 5.3 已实现的共享工具

#### `clampToViewport` — 视口位置钳制（纯函数，非 Hook）

```typescript
// 用途：将弹出框位置钳制在视口边界内，确保不超出屏幕
// 位于 lib/utils.ts，被 TContextMenu、TTip、TDropdown 等消费
export function clampToViewport(
  x: number, y: number, width: number, height: number, padding?: number,
): { left: number; top: number };
```

### 5.4 待观察的共享 Hook

#### `useHover`

```typescript
// 用途：统一鼠标悬停态管理（替代多处 useState + onMouseEnter/Leave）
// 当前 2 处重复，出现第 3 处时抽取到 hooks/useHover.ts
export function useHover(): { hovered: boolean; hoverProps: { onMouseEnter: () => void; onMouseLeave: () => void } };
```

---

## 6. Tauri IPC 通信规范

### 6.1 IPC 接口层（按领域拆分）

```typescript
// src/lib/ipc/ —— 所有 IPC 通信的入口目录
// 结构：types.ts（类型）+ 按领域拆分的方法文件 + events.ts + index.ts（统一导出）
//
// 消费方只需：import { ipc, events } from '@/lib/ipc'
// 类型导入：import type { ConnectionConfig } from '@/lib/ipc'

// ═══ 类型定义 ═══
export interface ConnectionConfig { /* ... */ }
export interface SftpEntry { /* ... */ }
export interface SystemInfo { /* ... */ }

// ═══ invoke 封装 ═══
export const ipc = {
  // SSH
  ssh: {
    connect: (config: ConnectionConfig) => invoke<string>('connect_ssh', { config }),
    disconnect: (id: string) => invoke<void>('disconnect_ssh', { id }),
    sendInput: (id: string, data: number[]) => invoke<void>('send_ssh_input', { id, data }),
    resize: (id: string, cols: number, rows: number) =>
      invoke<void>('resize_terminal', { id, cols, rows }),
    test: (config: ConnectionConfig) => invoke<string>('test_connection', { config }),
  },

  // SFTP
  sftp: {
    listFiles: (config: ConnectionConfig, path: string) =>
      invoke<SftpEntry[]>('sftp_list_files', { config, path }),
    readFile: (config: ConnectionConfig, path: string) =>
      invoke<string>('sftp_read_file', { config, path }),
    writeFile: (config: ConnectionConfig, path: string, content: number[]) =>
      invoke<void>('sftp_write_file', { config, path, content }),
    // ...
  },

  // Local terminal
  local: {
    detectShells: () => invoke<ShellInfo[]>('detect_shells_list'),
    connect: (shellPath: string) => invoke<string>('connect_local', { shellPath }),
    disconnect: (id: string) => invoke<void>('disconnect_local', { id }),
    // ...
  },

  // Config
  config: {
    load: () => invoke<ConnectionConfig[]>('load_configs'),
    save: (config: ConnectionConfig) => invoke<void>('save_config', { config }),
    update: (id: string, config: ConnectionConfig) => invoke<void>('update_config', { id, config }),
    delete: (id: string) => invoke<void>('delete_config_by_id', { id }),
  },

  // Monitor
  monitor: {
    fetch: (config: ConnectionConfig) => invoke<SystemInfo>('monitor_fetch', { config }),
    exec: (config: ConnectionConfig, command: string) =>
      invoke<string>('monitor_exec', { config, command }),
  },

  // SFTP Edit
  edit: {
    start: (config: ConnectionConfig, remotePath: string, editor?: string) =>
      invoke<string>('sftp_start_edit', { config, remotePath, editorCommand: editor || null }),
    stop: (sessionId: string) => invoke<void>('sftp_stop_edit', { sessionId }),
  },
};

// ═══ 事件监听 ═══
export const events = {
  onTermOutput: (handler: (p: { sessionId: string; data: number[] }) => void) =>
    listen<{ sessionId: string; data: number[] }>('term-output', (e) => handler(e.payload)),
  onSessionReady: (handler: (p: { sessionId: string }) => void) =>
    listen<{ sessionId: string }>('session-ready', (e) => handler(e.payload)),
  onSessionError: (handler: (p: { sessionId: string; error: string }) => void) =>
    listen<{ sessionId: string; error: string }>('session-error', (e) => handler(e.payload)),
  onSftpEditUploaded: (handler: (p: {
    sessionId: string; remotePath: string; success: boolean; error?: string;
  }) => void) =>
    listen('sftp-edit-uploaded', (e) => handler(e.payload)),
};
```

**规则：**
- 组件中**禁止**直接调用 `invoke()`，必须通过 `ipc` 对象
- `ipc` 按功能域分组为子对象（`ipc.ssh.connect()` 而非 `ipc.sshConnect()`）
- 新增 IPC 方法时在 `lib/ipc/` 对应领域文件中添加，并在 `index.ts` 中注册
- 新增 IPC 方法时**同步**更新前后端：ipc 领域文件 + Rust 命令 + `lib.rs` 注册
- 事件名使用 kebab-case，事件 payload 使用 camelCase

### 6.2 Rust 命令规范

```rust
// 命名：{领域}_{动作}，全 snake_case
#[tauri::command]
pub async fn connect_ssh(
    app_handle: tauri::AppHandle,       // 发事件时注入（不需要发事件时可省略）
    state: tauri::State<'_, AppState>,   // 访问共享状态时注入
    config: ConnectionConfig,            // 业务参数
) -> CmdResult<String> {
    // 1. 参数校验
    // 2. 调用业务层
    // 3. 更新状态
    // 4. 返回结果
}
```

**参数顺序（固定）：** `app_handle` → `state` → 业务参数

---

## 7. 状态管理规范

### 7.1 Store 职责划分

| Store               | 职责                         | 持久化 | 存储位置        |
|---------------------|-----------------------------|--------|----------------|
| `useSettingsStore`  | 用户偏好（主题/字体/行为/布局） | 是     | localStorage   |
| `useTerminalStore`  | 标签页生命周期（CRUD/切换/排序）| 否     | 内存           |
| `useSessionStore`   | 会话元数据（M2 完善）          | 否     | 内存           |

**规则：**
- Store 之间不直接引用，跨 Store 通信通过组件层协调
- 持久化 Store 使用 `persist` middleware，通过 `partialize` 精确控制持久化字段
- Action 命名：`add` / `remove` / `set` / `toggle` / `move` + 名词

### 7.2 选择器规范

```typescript
// ✅ 正确：原子选择器，精确订阅
const fontSize = useSettingsStore((s) => s.fontSize);
const tabs = useTerminalStore((s) => s.tabs);

// ❌ 错误：订阅整个 store，任何字段变化都触发重渲染
const settings = useSettingsStore();
```

---

## 8. 国际化 (i18n) 规范

### 8.1 Key 结构

```json
{
  "terminal": {
    "connecting": "正在连接到 {username}@{host}:{port}...",
    "connectionLost": "连接中断: {reason}",
    "connectionFailed": "连接失败: {error}"
  },
  "titleBar": {
    "newConnection": "新建连接",
    "toggleTheme": "切换主题"
  }
}
```

**规则：**
- Key 层级：`功能域.子域.具体字段`，使用点分隔
- 插值使用 `{paramName}` 语法
- 中英文 JSON 文件的 Key 结构**必须完全一致**
- 新增文本时**同步**更新 `zh-CN.json` 和 `en-US.json`

### 8.2 使用方式

```typescript
// 组件内 → useI18n()
const { t } = useI18n();
<span>{t('settings.theme')}</span>

// 非组件上下文（终端输出等）→ getMessage()
term.write(getMessage('terminal.connecting', {
  username: config.username,
  host: config.host,
  port: String(config.port),
}));
```

---

## 9. 样式规范

### 9.1 核心原则

1. **CSS 变量**管理所有颜色和尺寸语义 → `src/index.css`
2. **Tailwind v4** 处理布局和工具类 → `className`
3. **内联 style** 处理动态计算值和极端定制 → `style={{}}`
4. **禁止**创建独立组件 CSS 文件（`.module.css` 等）

### 9.2 Tailwind 与 CSS 变量的配合

```tsx
// 布局用 Tailwind
<div className="flex flex-col h-full">
  <div className="flex-1 min-h-0">

// 颜色和语义用 CSS 变量
<button style={{
  background: 'var(--tx-accent-default)',
  color: 'var(--tx-text-inverse)',
  borderRadius: 'var(--tx-radius-md)',
}}>
```

### 9.3 深色/浅色主题

在 `:root` 定义浅色值，`.dark` 覆盖为深色值。新增变量时必须同步定义两个主题的值。

```css
:root { --tx-bg-base: #ffffff; }
.dark { --tx-bg-base: #0d1117; }
```

---

## 10. 测试规范

### 10.1 测试策略

| 层级         | 测试类型   | 覆盖要求        |
|-------------|----------|----------------|
| Rust 业务逻辑 | 单元测试   | 核心逻辑 > 80%  |
| Rust 命令    | 集成测试   | 关键流程        |
| React 组件   | 单元测试   | UI 组件 / Hook  |
| E2E         | 端到端测试 | 核心用户路径     |

### 10.2 Rust 测试

```rust
// 单元测试放在源码文件底部，#[cfg(test)] 隔离
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_serialize_deserialize() { /* ... */ }

    #[tokio::test]
    async fn test_session_spawn_and_close() { /* ... */ }
}
```

### 10.3 规则

- Rust 测试放在文件底部 `#[cfg(test)] mod tests` 中
- 测试命名：`test_` + 函数名 + `_` + 场景描述
- 测试独立、可重复、不依赖外部环境
- CI 中所有测试必须通过

---

## 11. Git 提交规范

### 11.1 分支策略

```
main           —— 生产分支，保持稳定
├── dev        —— 开发分支（可选）
├── feat/*     —— 功能分支（feat/ssh-key-auth）
├── fix/*      —— 修复分支（fix/terminal-resize-ime）
└── refactor/* —— 重构分支（refactor/extract-ui-components）
```

### 11.2 Commit Message

```
<type>(<scope>): <简短中文描述>

类型：feat | fix | refactor | style | docs | test | chore
范围：rust | ui | tauri | config

示例：
  feat(rust): 添加 SSH 密钥认证支持
  fix(ui): 修复终端 resize 时 IME 输入中断的问题
  refactor(ui): 抽取 TIconButton 统一标题栏和终端工具栏按钮逻辑
  chore: 升级 Tauri CLI 到 2.11.1
```

---

## 12. 新功能开发 Checklist

开发新功能时，按以下清单逐项检查：

- [ ] 新增的 CSS 变量使用 `--tx-` 前缀，且在 `:root` 和 `.dark` 中同步定义
- [ ] 新增的通用 UI 组件放在 `ui/` 目录，使用 `T` 前缀命名
- [ ] 业务 Hook 就近放在对应的功能模块目录中，通用 Hook 放在 `hooks/`
- [ ] Import 使用 `@/` 路径别名（禁止 `../../` 跨目录相对路径），同目录内可使用相对路径
- [ ] 出现第 3 次重复的模式已抽取为共享组件/Hook/工具函数
- [ ] IPC 调用通过 `ipc` 对象（非直接 `invoke()`），新增方法在 `lib/ipc/` 对应领域文件中添加
- [ ] Rust 命令返回 `CmdResult<T>`，业务逻辑在业务层实现
- [ ] 新增的可翻译文本已同步到 `zh-CN.json` 和 `en-US.json`
- [ ] Store selector 使用原子选择器（非订阅整个 store）
- [ ] 组件内部结构按规范顺序排列
- [ ] 超过 300 行的组件已拆分
- [ ] Props 类型已定义为 interface 并导出
- [ ] 导出组件使用 `React.memo` 包裹
- [ ] 复杂逻辑已添加中文注释说明原因

---

> **最后提醒：** 本规范是**活文档**——在开发过程中发现更好的模式时，应及时更新规范本身。规范的目标是提高团队效率和代码质量，而非束缚手脚。遇到规范不适用的情况，先讨论再修改规范。
