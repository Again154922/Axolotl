# feat/frontend-enhancement 功能变更记录（临时）

- **分支**：`feat/frontend-enhancement`
- **基线**：`main`（含上游合并 / #554 merge `30d37da18`）
- **草稿 PR**：https://github.com/Mystic-Stars/Axolotl/pull/555（WIP，取代 #554）
- **记录时间**：2026-09-13
- **状态**：本节前端增强改动待提交（不含 `.commandcode/`、`.agents/`）

---

## 1. 发现内容页（Browse）

### 1.1 工具栏悬浮 Chrome
- **提交**：`cc6303b26`
- 类型 NavTabs、搜索框、排序/每页/显示/分页、筛选 Tag 聚合为 `browse-toolbar-chrome`
- `sticky top-0 z-20`，结果滚动时工具栏固定在内容区顶部
- 安装上下文头部与工具栏同 sticky，避免两个 `top-0` 重叠
- app / web 变体样式分离

### 1.2 地图 Tab 缺 API key 崩溃
- **提交**：`3ea433cc9`
- 进入「地图」时不再无条件把 `contentSource` 设为 `curseforge`
- 未配置 CurseForge 时跳过分类请求，显示既有空状态

### 1.3 SPA 分页（非整页刷新）
- **提交**：`47028410b`
- `refreshSearch` 始终置 `loading`，翻页/筛选可驱动骨架与分页 Spinner
- browse 路由 transition key 按 `projectType`：切页类型 remount，仅改 query 复用同一实例

### 1.4 内容卡加载态
| 提交 | 内容 |
|---|---|
| `b20574ca7` | 分页 Spinner + 列表骨架卡 |
| `c3856ff69` | `ContentCardReveal`；首次 Skeleton，刷新遮罩缓冲，就绪淡入 |
| `35f820048` | loading 时**始终**用 Skeleton 占位（不再只遮罩旧卡） |
| `7c7338f2a` | Skeleton 按 layout 区分：list 横向行 / compact 单行 / grid 横幅，避免整页一张大卡 |

### 1.5 空态
- **提交**：`d31f95d94`
- `EmptyState`：图标芯片 + 标题 + 副标题 + 操作按钮（设计令牌）
- 预设：offline / no-results / error / empty
- 发现页：离线「重试」、无结果「清除搜索」

---

## 2. 分页组件（Pagination）

### 2.1 「...」跳页
- **提交**：`197887e92`
- 点击省略号 → 数字输入框
- Enter/失焦跳页（夹取 1…count），Esc 取消
- i18n：`pagination.go-to-page` 等

### 2.2 loading Spinner
- `loading` prop：当前页显示 Spinner，导航禁用
- 由 Browse 的 `ctx.loading` 驱动

---

## 3. 设置页信息架构

### 3.1 分组与排序
- **提交**：`adefbf05f`
- **界面**（原启动器）：外观 → 首页与导航 → 键盘快捷键 → 语言与翻译 → AI 功能
- **游戏**：启动默认值 → Java 与性能 → 内容与下载 → 网络与多人
- **数据与隐私**：存储与备份 → 隐私与数据共享
- **应用与支持**：更新 → 关于 → 日志与诊断
- **开发者**：功能开关

### 3.2 文案
| 旧 | 新 |
|---|---|
| 启动器 / Launcher | 界面 / Interface |
| 界面与外观 | 外观 / Appearance |
| 快捷键管理 | 键盘快捷键 / Keyboard shortcuts |
| AI | AI 功能 / AI features |
| 启动与实例默认值 | 启动默认值 / Launch defaults |
| 日志 | 日志与诊断 / Logs & diagnostics |

### 3.3 重置与导出（已添加后撤销）
- `d606cc616` 曾加入向导（按页/分组/全部、导出 JSON、Spinner/Skeleton、离开警告）
- `1ae1e4778` 修 SettingsSection 本地导入
- **`1abc15fd9` 已整体撤销**，当前分支无此功能

---

## 4. 设计令牌统一

- **提交**：`98c9514d0`
- `rounded-[20px]` → `rounded-[var(--radius-xl)]`（十余处）
- 品牌 rgba → `color-mix(..., var(--color-*), transparent)`
- UI 组件 `--color-bg` / `--color-raised-bg` → `--surface-1` / `--surface-2`（指定文件）
- 应用页：SplashScreen、Lab 预览、Appearance 滑块、Storage 图表、Beta 徽章
- **保留**：终端 ANSI、Lab 画布绘色、无 token 的 symlink 调色板

---

## 5. 强调色选择器（自 #551 并入）

- **来源 PR**：#551（已关闭，分支已删除）
- **并入提交**：`dd7c5639a`
- 强调色 chip flex-wrap、勾选角标脱离布局流、窄屏不重叠
- 相关提交：`c80472a83`、`a16a77f27`、`0f6fed2e9`、`07bd7bc21`

---

## 6. 启动器背景：预览合并上传 + 拖拽

- 预览区即上传入口：点击打开文件选择器
- 空态文案明确提示可拖入：「点击选择，或拖放图片到此处」
- 支持拖入图片：Tauri `onDragDropEvent` + 预览区命中检测；拖入时高亮 `border-brand`
- 有图时 hover/focus 显示「更换 / 移除」底栏，不再单独占一行按钮
- 从拖放路径读取使用 `plugin:files|file_read_dragged_file`（与 Skins 一致）
- 全局 drop：`/settings` 路径下跳过图片分类，避免与背景设置抢同一文件；设置页不显示全局拖入遮罩
- i18n：`custom-background.drop-hint`、`custom-background.choose-or-drop`；描述文案改为「选择或拖入」

---

## 6b. 设置搜索自动完成

- 视觉层级：分类结果更重（图标 contrast + 尾部 chevron）；条目结果缩进 + 常规字重 + 面包屑
- 交互态：hover（surface-3 + brand 图标）、pressed（surface-4 + scale）、focus-visible（brand outline）
- 输入时 `TransitionGroup` 错落入场（180ms ease，最多 168ms stagger）
- 匹配片段 brand + 加粗
- **输入防抖骨架**：query 变化 120ms 内显示 5 行结果骨架，防抖后再渲染结果

---

## 6c. 设置分类切换骨架 + 淡入淡出

- 切换侧栏分类时：内容区骨架覆盖层（标题/描述/设置行占位），最少展示 160ms，并等待 Suspense settle
- 内容 body：`is-loading` 时 opacity 0 + 轻微下沉，`is-ready` 淡入
- 标题 header：`out-in` 淡入淡出
- 修复：Suspense 尚未 `pending` 时提前结束计时导致骨架卡死（改为轮询等待 settle）

---

## 6d. 语言与翻译 / 系统语言 / 引导

### 语言选择
- 设置页语言改为可搜索 Combobox（不含系统语言选项）
- **系统语言独立开关**：下拉同一行右侧按钮式 switch（Monitor 图标 + 文案 + tooltip）
- 开启时：下拉占位显示「系统语言」并展示解析到的具体语言；**点击下拉自动关闭跟随**（Combobox `open`）
- 欢迎首屏：原生 `<select>`（Combobox 下拉 z-index 低于引导遮罩）；`pointerdown`/`focus` 同样自动关闭跟随
- 系统语言实现：localStorage 跟随标记 + 具体 locale 落库（兼容后端 `zh-CN`）；启动 `applyLocalePreference` 重解析

### AI 设置
- 概览顶部 info：内容翻译在「语言与翻译」，可一键跳转

### 自动翻译引导提示
- 发现页 / Mod 详情（Modrinth + CurseForge）手动点「翻译」累计 **3 次**后弹一次 info 通知，指向「设置 → 语言与翻译」
- 守卫：`auto_translate` 已开启则直接跳过并记住；`localStorage` 记「已提示」，只出现一次
- 实现：`noteManualTranslateClick()` + `autoTranslateHintMessages`（`helpers/translation.ts`）

### 页面切换阴影错位修复
- 原因：`page-slide` 对 layer 施加 `transform`，使 `sticky` 工具栏与 `fixed` 阴影层相对 layer 定位，切换时阴影滑动/卡住
- 修复：页面切换改为纯 opacity；`.app-contents::before` 从 `fixed` 改为 `absolute inset: 0`；内容区 `isolation: isolate`；粘顶时工具栏加投影
- 发现页选项卡：`NavTabs` 的 `drop-shadow-xl` 改为 `box-shadow`；`ResizeObserver` 在容器重排时 **无动画 snap**（跳过位置未变化的回调），避免加载完瞬移左移再回位
- 切换导航页：`runAfterPageTransitionSettle`（约 200ms + idle）后才拉浏览首屏搜索 / 首批 CurseForge 分类，降低切换动画卡顿
- 发现页标签 SPA：`getPageTransitionKey` 不再按 `projectType` remount；内容类型切换复用同一 Browse 实例；Favorites 单独 key；切型时滚回顶栏并同步面包屑

### 前端检查警告清理
- ESLint：修复 unused / empty-catch / template-shadow；共享配置关闭 `vue/require-default-prop`、`vue/no-v-html`（系统性可选 prop / 受信任 Markdown）
- FormatJS：拆分冲突 message id；biome 文案改为静态 `defineMessages`；补简中 biome 翻译
- `scripts/run.mjs` 避免 DEP0190（shell 传参）

### 依赖升级 + 启动异步
- 前端依赖在同 major 内升至较新版本（vue/vite/tauri plugins/vue-query/dayjs/dompurify/three 等）
- 根目录 `pnpm.overrides.typescript` 钉在 5.9.3，避免误解析到 TS7
- **有意保留 major**：Tailwind 3、Nuxt 3、ESLint 9、vue-router 4、pinia 3、vue-i18n 10、fuse.js 6、apexcharts 4、tresjs 4（升级需迁移）
- `runWhenIdle`：App 启动后检查更新 / elevated 警告 / direct-link 同步延后到 idle
- RemoteAnnouncements 轮询与 Favorites 首拉数据改为 page-settle / idle 后执行

### 引导流程
- 欢迎首屏设语言，不再作为导览步骤，也不自动重启
- 发现页去掉写死 `expectedPath=/browse/modpack`（修复重放/第 5 步卡住）
- 设置导览：外观 → 语言与翻译 → 启动默认 → 内容下载
- 文案与当前 IA 对齐（设置/外观/语言）
- **遮罩**：全屏半透明 mask + 目标挖洞；inspect/control 均高亮；control 保留四角
- **重放定位**：安全区读 `--top-bar-height`；目标 `scrollIntoView` 避开底部气泡/顶栏；双 rAF 重测

---

## 7. 主要文件

| 区域 | 路径 |
|---|---|
| 发现布局 | `packages/ui/src/layouts/shared/browse-tab/layout.vue` |
| 搜索加载 | `.../composables/use-browse-search.ts` |
| 骨架/淡入 | `packages/ui/src/components/project/ProjectCardSkeleton.vue`、`ContentCardReveal.vue` |
| 分页 | `packages/ui/src/components/base/Pagination.vue` |
| 空态 | `packages/ui/src/components/base/EmptyState.vue` |
| 设置 IA | `apps/app-frontend/.../settings-category-definitions.ts`、`settings-registry.ts` |
| 路由 key | `apps/app-frontend/src/App.vue`（`getPageTransitionKey`） |
| 强调色 / 背景 | `AppearanceSettings.vue` |
| 全局 drop | `useDropImport.ts`、`App.vue`（`onSettingsPage`） |
| 设置页搜索/骨架 | `apps/app-frontend/src/pages/Settings.vue` |
| 语言 | `LanguageSettings.vue`、`i18n.config.ts` |
| AI 翻译指引 | `AISettings.vue` |
| 引导 | `OnboardingWelcome.vue`、`OnboardingOverlay.vue`、`useOnboardingTour.ts`、`onboardingConfig.ts` |

---

## 8. 合入的外部 PR

- **#554** `dce791ac6` — 关于页 COPYING 指南链接（属性名 `copyingGuidelines` 与模板对齐）
- merge commit：`30d37da18`
- 本 PR（#555）合并后可关闭 #554

---

## 9. 未合入 / 已撤销

| 项 | 说明 |
|---|---|
| 设置重置向导 | 已添加并撤销（`1abc15fd9`） |
| 导航标签展开（点 Logo） | `f6299a802` 已 `reset --hard` 撤销 |
| #546 CI 资产复用 | 独立分支/PR，不在本分支 |
| #548 迁移工具 | 独立分支/PR，不在本分支 |

---

## 10. 验证备注

- `axolotl:i18n-check` 通过
- `settings-search` 单测存在基线 `ERR_UNSUPPORTED_DIR_IMPORT`（node 不能引 `@modrinth/ui`）
- 视觉与交互需在 `pnpm app:dev` 人工确认（背景拖拽、系统语言开关、引导遮罩/重放）
- 确认后可将 #555 从 draft 转 ready
- 背景拖拽：需在桌面端验证 OS 文件拖入（HTML5 drop 会被 Tauri 拦截）
