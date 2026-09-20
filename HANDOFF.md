# 电商作战室 · 项目交接提示词（续编专用）

> 把下面从「# 电商作战室」到文末的全部内容，整体粘贴到**另一台电脑上的新对话**里，AI 即可基于完整背景继续帮你改这个项目。不要只贴片段。

---

# 电商作战室 — 纯前端国内电商选品/运营 PWA

## 0. 你的角色
你是这个项目的主程助手。下面是完整背景与代码现状，请基于它继续开发，**不要重新追问基础问题**。改代码时遵循第 6 节约定，改完告诉我改了什么、怎么验证。

## 1. 项目目标（来自项目设定）
帮用户做**国内电商选品**：用户不知道该卖什么、需要专业运营建议、并且希望系统能根据他**可投资的活动资金**灵活给出选品与启动建议。已做成纯前端 PWA，部署在 GitHub Pages。

## 2. 技术栈与硬约束
- **纯前端 SPA**：原生 HTML + CSS + JavaScript，**无框架、无打包构建步骤**。浏览器直接打开 / 静态托管即可运行。
- **部署**：GitHub Pages，仓库 `https://github.com/xiaomin999/ecom-warroom.git`（原始分支 main）。
- **PWA**：`manifest.webmanifest` + `sw.js` + `assets/icons/*.png`（图标由 `gen_icons.py` 生成，纯标准库，可重跑）。
- **LLM 客户端**：OpenAI 兼容 `/chat/completions`。默认**直连**阿里云百炼/DashScope（`https://dashscope.aliyuncs.com/compatible-mode/v1`，默认模型 `qwen-turbo`）。也支持**服务端代理**（`server.js` 的 `/api/llm`，Key 走环境变量，不落浏览器）。
- **联网搜索**：`ECOM.llm(messages, {search:true})` 会在请求体顶层加 `enable_search:true` + `search_options:{search_strategy:'turbo'}`。注意：**qwen-turbo 不支持联网**，要联网请用 `qwen-plus` / `qwen-max`。
- **持久化**：全部 `localStorage`。键名：设置 `ecom_settings_v1`、选品简报 `ecom_brief_v1`、选品库 `ecom_briefs_v1`、供应商对比 `srcCompare`、表单草稿 `ecom_draft_<moduleId>`、子 tab `sourcingTab`、联网刷新时间 `discoverLiveAt`、可投资金存进 `ecom_settings_v1.capital`（字段名 `capital`）。
- **国内化**：所有模块平台只用国内平台（淘宝/天猫、京东、抖音电商、拼多多、小红书、视频号、快手电商、1688）。**不要引入任何海外平台**。

## 3. 必懂架构（ECOM 命名空间）
- `window.ECOM` 在 `lib/core.js` 里定义，是全局单例。
- **注册模块**：`ECOM.register({ id, name, icon, group, desc, render(root) })`。
- 导航分组顺序由 `app.js` 的 `GROUP_ORDER = ['市场情报','选品','内容','策略','一站式']` 控制，其余组排后面。
- `render(root)`：root 是 `#moduleBody`，模块往里写 DOM；切换时 app 用 `viewCache` 整体挪动 DOM 而非重建（见 6）。
- 核心 API（调用时直接用）：
  - 存储：`ECOM.store.get()` / `ECOM.store.set(obj)`
  - LLM：`ECOM.llm(messages, opts) -> string`；`opts.search` 联网；`opts.temperature`；`opts.model/baseUrl/apiKey` 可临时覆盖；`opts.useProxy` 走代理
  - 消息：`ECOM.msg(role, content)`
  - 可用性：`ECOM.hasLLM()`、`ECOM.llmMode()`（`'proxy'|'direct'|'none'`）
  - UI：`ECOM.ui.toast(msg)` / `ECOM.ui.copy(text)` / `ECOM.ui.download(name,text)` / `ECOM.ui.run(btn, fn)`（loading 态+错误 toast）/ `ECOM.ui.resultCard(title)`（带复制+导出 PDF/Word/MD 的卡片）
  - 导出：`ECOM.ui.exportPDF(name,title,md)` / `exportWord(...)`；`ECOM.mdToHtml(md)`（安全子集渲染）
  - 选品简报：`ECOM.brief` / `ECOM.getBrief()` / `ECOM.setBrief(obj)` / `ECOM.clearBrief()` / `ECOM.loadBrief(id)`；选品库 `ECOM.briefLib.list()/upsert()/get()/remove()`
  - 简报联动：`ECOM.applyBrief(root)` 把当前简报预填进下游模块输入框并加简报条
  - 资金：`ECOM._capital`（数字）；`app.js` 启动从 `store.capital` 恢复
  - 路由：`ECOM.go(id)` 切模块（app.js 初始化时挂上）
- **资金档判定**（discover / sourcing / selection 共用同一套）：`A <1万 / B 1-5万 / C 5-20万 / D >20万`。

## 4. 文件结构与职责
```
ecom-platform/
├── index.html            # 入口：依赖加载顺序 + 顶栏/侧栏/主区域骨架 + PWA meta
├── style.css             # 全部样式（当前 ?v=3）
├── app.js                # 启动器：导航渲染/路由 go/设置弹窗/移动端/状态保留/草稿/PWA 注册（?v=1）
├── lib/
│   └── core.js           # ECOM 命名空间：存储/LLM/UI/Markdown/选品简报与库（?v=2）
├── modules/
│   ├── intel.js          # 市场情报：需求洞察(insight) + 竞品分析(compete)
│   ├── selection.js      # 选品分析：AI建议 + 离线打分卡 + 可投资金联动选品（含资金档模板）
│   ├── library.js        # 我的选品库：保存/切换简报/对比/进流水线
│   ├── content.js        # 内容：标题生成(title) + 卖点文案(copy) + 详情页(detail)
│   ├── strategy.js       # 策略：活动策略(campaign) + 广告策略(ads)
│   ├── image.js          # 做图：本地构建图像 Prompt + AI 润色（可选接图像 API）
│   ├── pipeline.js       # 作战流水线：把选品库简报一键跑通上述所有内容模块
│   ├── discover.js       # 品类灵感：41 个联网整理品类 + 联网刷新最新爆款（?v=2）
│   └── sourcing.js       # 货源参谋：找货导航/货源体检/代发决策/供应商对比（?v=3）
├── data/
│   └── categories.js     # 品类灵感静态快照：window.CATEGORY_INSIGHTS = {updated,note,modes,items[]}（41 项）
├── server.js             # 可选 Node 服务：静态托管 + /api/llm 代理（藏 Key，环境变量 LLM_BASE_URL/LLM_API_KEY/PORT）
├── sw.js                 # Service Worker 离线缓存（⚠️ 见 6 坑）
├── manifest.webmanifest  # PWA 清单
├── gen_icons.py          # 纯标准库生成 PWA 图标（可重跑）
├── assets/icons/         # icon-192/512/maskable/apple-touch-icon.png
└── package.json          # 仅记录，无依赖
```
**index.html 当前脚本顺序（重要，app 必须最后）**：
`lib/core.js?v=2` → `modules/pipeline.js` → `selection.js` → `library.js` → `content.js` → `strategy.js` → `intel.js` → `data/categories.js?v=1` → `modules/discover.js?v=2` → `modules/sourcing.js?v=3` → `modules/image.js` → `app.js?v=1`
（样式：`style.css?v=3`）

## 5. 当前已完成（截至 2026-09-10，commit b853d99）
- 导航按国内电商工作流重排 + 全站国内化；支持手机安装到桌面（PWA）。
- **三层状态保留**：① 切模块不丢（DOM 整体挪动）；② 刷新不丢表单（localStorage 草稿）；③ 子 tab 缓存（sourcing/selection 内部 tab 不重渲染）。
- **市场情报**：需求洞察（场景词/笔记→机会报告）、竞品分析（链接/标题/笔记→卖点定价人群货源拆解）。
- **选品分析**：AI 建议 + 离线 5 维打分卡（利润/竞争/复购/物流/趋势，权重可改）+ 可投资金联动测算（填成本/客单价→备货/毛利/回本）。
- **我的选品库**：保存多个方向、设为当前简报、勾选对比、一键进流水线。
- **内容**：标题生成（按平台风格埋词）、卖点文案、详情页结构；结果卡片支持导出 PDF/Word/MD。
- **策略**：活动策略（大促/节日/清仓节奏与优惠梯度）、广告策略（投放结构/词包/出价/预算）。
- **做图**：本地构建图像 Prompt + AI 润色（图像 API 留位 `imageBaseUrl`）。
- **作战流水线**：把选品库简报一键跑通标题/文案/详情页/活动/广告/做图。
- **品类灵感**：41 个联网整理的 2026 国内电商品类（按资金档 A/B/C/D 分组），可「联网刷新最新爆款」（复用已配模型 + `enable_search`），超过 24h 自动联一次；「＋带入资金选品」一键跳选品分析。
- **货源参谋（4 子 tab）**：
  1. 找货导航（离线方法论 / 联网搜真实货源 JSON）；
  2. 货源体检打分卡（评分/年限/响应/退货率/验厂/牛头标/代发/质检 → 靠谱度分级 + 风险 + 私聊话术；也支持贴描述 AI 体检）；
  3. 代发决策（按资金档给 代发/囤货 模式 + 首单/安全垫预算 + 落地步骤 + 资金红线）；
  4. 供应商对比（主表比 供应商/链接/拿货价/起批量/评分/代发，点「展开 ▾」填 样品费/周期/运费/发货地/经营年限/验厂/账期/退换货/备注；自动高亮最低价&最高评分；链接可点「打开」跳转；导出 PDF/Word 含全部 15 字段）。

## 6. 关键约定与坑（务必遵守）
1. **版本戳（cache bust）**：`index.html` 里每个 js/css 引用都带 `?v=N`。**改了文件就把对应戳 +1**，否则部署后浏览器用旧缓存。本地预览可不加，部署必须加。
2. **sw.js 是缓存层，目前是过时的**（重要坑）：`sw.js` 的 `ASSETS` 列表写的是 `?v=1`，且**漏了 `discover.js`、`sourcing.js`、`data/categories.js`**，与 `index.html` 的戳不一致。要让 PWA 离线缓存生效，改这些文件后必须：① 把 `CACHE` 名 `ecom-warroom-v1` → `v2`；② 同步更新 `ASSETS` 列表（含正确戳和新增文件）。否则离线跑的是旧版。
3. **脚本加载顺序**：模块必须先于 `app.js` 注册（app 启动才 `renderNav`）。新增模块要在 `app.js` 之前加 `<script>`。
4. **状态保留三层**已在 app.js 实现：`viewCache` 挪 DOM；`REFRESH_ON_ENTER = new Set(['library','pipeline'])` 这两个每次进重渲染（因为它们是数据驱动，要显示最新）；`ecom_draft_<id>` 自动存读；子 tab 用 `holders{}`/缓存变量保留 DOM。**新增表单型模块默认会被草稿保护；数据驱动型要加进 REFRESH_ON_ENTER**。
5. **推送避免卡死**：在已 git 登录的机器上，普通 `git push` 若弹 GCM 图形窗卡住，用（Token = 有 repo 权限的 GitHub PAT，命令行临时用，别写进代码）：
   ```bash
   GCM_INTERACTIVE=never git -c credential.helper= push https://xiaomin999:TOKEN@github.com/xiaomin999/ecom-warroom.git
   ```
   或先 `git config --global credential.helper manager` 登录一次。
6. **jsdom 集成测试坑**（若你要写自动化测试）：`data/categories.js` 必须 `window.eval` 进全局；`app.js` 须在 modules 之后加载；jsdom 里 localStorage 需要 https url；属性选择器用 DOM 遍历而非 CSS 转义；`?v=` 戳会让文件加载失败，要手动 eval。
7. **UI 风格**：白底浅色主题、卡片式布局、中文界面、emoji 图标；新增模块沿用现有 `.card/.row/.field/.tabs/.tab/.primary-btn/.secondary-btn/.hint/.cat-*` 等 class，保持视觉一致。

## 7. 本地运行 / 验证
- **纯静态**：用任意 http 服务，例如 `npx http-server -p 8080` 或 `python -m http.server 8080`，开 `http://localhost:8080`。**不能用 `file://` 打开**（模块/CORS 会失败），必须 http(s)。
- **带代理（服务端藏 Key）**：`node server.js`（默认 `http://localhost:3000`；环境变量 `LLM_BASE_URL` / `LLM_API_KEY` / `PORT`）。访问 3000 端口时 `detectProxy()` 自动走 `/api/llm`。
- **配置模型**：点右上角 ⚙️ → 填 API Base / Key / 模型，或勾选「启用代理」。
- **验证清单**：导航分组顺序、切模块输入不丢、刷新不丢、品类灵感 41 项 + 联网刷新、货源参谋 4 子 tab、供应商对比可展开/链接跳转/高亮/导出、结果卡片导出 PDF/Word。

## 8. 之前停在这里的待办 / 可继续方向
- **[建议未做]** 把「货源体检」的 验厂/牛头标/代发 状态**联动进「供应商对比」**，避免重复录入。
- **[可选]** 选品库导出/导入（目前只在 localStorage）。
- **[可选]** 每日自动抓最新爆款需要轻量后端（`server.js` 定时任务或外部 cron）；目前是前端「进入超 24h 自动联一次」的折中。
- **[可选]** `selection` 打分卡与 `discover` 联动、活动/广告模块接真实数据、图像模块接图像 API（已留 `imageBaseUrl` 位）。
- （`BOOTSTRAP.md` 是 WorkBuddy 工作区自身身份文件，与本项目无关，可忽略。）

## 9. 续编示例（粘贴后直接说一句）
- “把货源体检的验厂/牛头标/代发状态联动进供应商对比”
- “增加选品库导出/导入”
- “更新 sw.js 让 PWA 正确缓存 discover/sourcing/categories”
- “给 selection 加更多资金档模板”
- “新增一个 XX 模块”
