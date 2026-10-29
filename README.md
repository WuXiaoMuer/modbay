# MODBAY · 模块湾 — 硬件定制平台

在线组合开发板、传感器、电机等硬件模块，形成自定义方案；实时校验引脚占用、I2C 地址冲突、电源预算与逻辑电平，并生成可导出的选型单。

- **形态**：纯静态 SPA（原生 HTML / CSS / JS，零构建、零依赖），双击 `index.html` 即可运行；本地预览 `python -m http.server 8321` 后访问 `http://127.0.0.1:8321/`
- **数据规模**：7 块基座 + 50 个功能模块（6 大类）+ 4 套预设方案（共 57 件商品，含 MG996R 舵机 / WS2812B 灯带等高电流负载与 18650 / 太阳能 / 降压外供电源）
- **视觉语言**：设计 token 取自 [ArtCraft](https://getartcraft.com/)（Archivo + Geist Mono，暗色 `#121316` / `#101014`，accent `#2d81ff`，扫描线质感、mono 编号分区），叠加 GitHub 主页的深色极客气场；默认暗色、右上角可切亮色并记忆。所有 PCB 示意图 / 接线图 / 热度图均由代码按 id 哈希程序化生成，无任何外部素材。
- **单测**：`node test-engine.js`（18 条校验引擎用例）；`_domtest.html` 为浏览器端 DOM 交互回归测试页（需通过 http 打开，逐条点击并输出通过/失败报告）

## 目录结构

```
modbay/
├── index.html                  入口（导航 / 挂载点 / 字体 / favicon）
├── assets/
│   ├── data-boards.js          7 块基座（引脚池、总线、电源轨容量）
│   ├── data-modules-1.js       传感器 + 执行与电机（20 件）
│   ├── data-modules-2.js       显示交互 + 通信存储 + 电源配件（12 件）
│   ├── data-modules-3.js       扩充热门件（18 件：高电流负载 / 外供电源 / 进阶传感器）
│   ├── data-presets.js          4 套预设方案
│   ├── style-core.css          tokens / 基础 / 导航 / 首页 / 页脚
│   ├── style-views.css          模块库 / 配置台 / 方案 / 指南 / 响应式 / 打印
│   ├── app-core.js              数据装配 / 状态持久化 / 校验引擎 / 引脚分配
│   ├── app-art.js               程序化 SVG（PCB、预设图标、热度条）
│   ├── app-views-home.js       首页
│   ├── app-views-explore.js    模块库
│   ├── app-views-build.js      选型配置台
│   ├── app-views-plan.js       方案预览（接线图 / 引脚表 / 3D 面板入口）
│   ├── app-3d-parts.js         3D 零件库（盒/圆柱元语 + 排针/IC/电容/散热片/探头/电池/车轮…）
│   ├── app-3d-scene.js         按型号装配配方（45+ 种模块专属零件组合）
│   ├── icon-system.js          统一图标系统（30+ 线性图标 / 分类图标 / 品牌标识 / 空态插画）
│   ├── anim.js                 动效编排（路由过渡 / 卡片 stagger / 按钮光斑 / 滚动进度）
│   ├── style-motion.css        动效与细节层（可被 prefers-reduced-motion 全量关闭）
│   ├── icons/                  站点图标（favicon.svg / favicon.ico / apple-touch-icon / PWA 图标）
│   ├── app-codegen.js          软件方案生成（BSP / 驱动 / 联动 / 协议 / 报价，双目标语言）
│   ├── app-board.js            底板设计图（mm 级 SVG：板框 / 安装孔 / 占位 / 焊盘 / 母线 / 工艺）
│   ├── app-canvas.js           自由画板（模块拖拽重排、总线脊柱连线、布局本机持久化）
│   ├── app-3d.js               自研 SVG 3D 渲染（旋转矩阵+背面剔除+方向光+画家算法+自动取景）
│   ├── app-views-guide.js      平台指南（规格说明）
│   ├── app-orders.js           订单域：下单 / 模拟支付 / 我的订单 / 演示后台
│   └── app-main.js             路由 / 事件绑定 / 导出 / 分享 / 主题
├── .nojekyll                   GitHub Pages 免 Jekyll 处理
├── vercel.json                 Vercel 部署配置（cleanUrls + 响应头）
├── _domtest.html               浏览器端 DOM 交互回归测试
└── test-engine.js              校验引擎单测
```

## 核心功能模块

| 模块 | 说明 |
| --- | --- |
| 硬件分类浏览 | 六大类（基座 / 传感器 / 执行电机 / 显示交互 / 通信存储 / 电源配件），分类筛选 + 关键词搜索 + 三种排序；卡片全量参数（接口、地址、供电轨、逻辑电平、典型电流、规格表） |
| 模块参数详情 | 每张卡片 PCB 示意图 + 品牌 + 价格 + 关键规格 4 行；数据驱动，增删模块只改 `data-*.js` |
| 自定义选型与组合 | 配置台三栏：模块库点击即加、基座下拉更换、± 数量、移除；localStorage 持久化；4 套预设一键载入后可继续编辑 |
| 方案预览与汇总 | 校验报告（红/黄/绿）→ BOM 表 + **装配估算**（杜邦线根数 / 总重）→ **3D 装配预览**（自研 SVG 软渲染，零依赖：45+ 种模块按真实零件建模——排针/屏蔽罩/USB-C/散热片/超声波双探头/舵机舵盘/18650 电芯/车轮…；布局为「左端叠装核心板 + 右侧模块插装区」，模块按实测包围盒平衡分行、居中落位并带接触阴影，底板长宽随选型自动伸缩；全周自动取景、拖拽旋转、滚轮缩放、点击模块高亮看参数，下方图例标注每个模块）→ 接线示意图（**总线束布线**：同一总线（I2C / SPI / GPIO）的引脚合并成一条粗主干并标注「SPI ×5」，模块从束上水平分支；GND / VCC 干线贴在模块框左侧、支线极短；电源区为垂直干线 + 同宽节点框，缺外供为红虚线幽灵节点）→ 引脚分配表（含电源/地行、冲突自检徽标与总线共享标注）→ 电源预算条 → 配件推荐（按选型缺口推电源板/电平转换，一键加购）；导出 JSON、复制 Markdown 清单、分享链接、打印 |
| 路由与可访问性 | 未知路由给 404 视图（回显原始路径 + 出口按钮）；Esc 关闭支付/发布浮层并停止轮询；表格横向滚动、打印样式只留正文 |
| 方案广场（玩家社区） | 一键发布方案到广场（名称/署名/标签/简介）、最热/最新排序、TOP3 榜、点赞、**Remix 改一改**（载入他人方案为草稿并署名来源）、广场方案直达下单（订单带来源标记，可做带货分成结算） |
| 下单与模拟支付 | 方案页「下单购买」→ 收货信息 + 支付方式 → 订单号生成 → 我的订单内模拟支付；真实通道为微信/支付宝扫码（见下） |
| 演示后台 | `#/admin`：订单统计（总数 / 有效销售额 / 待处理）、状态筛选、手动/批量推进（备货 → 发货 → 收货）、订单 JSON 导出 |
| 软件方案 | 由选型直接生成 **BSP + 驱动 + 联动 + 协议** 两套代码（MicroPython 可直接跑 / C 为 ESP-IDF 骨架）：引脚宏取自真实分配、I2C 地址取自器件数据、联动规则由「传感器 × 执行器」自动配对；面板内可切文件、复制、下载、导出全部。软件包四档独立定价，随硬件一起下单 |
| 底板设计图 | 按模块**实物尺寸（mm）**生成可打样的连接底板：板框 / 四角 M3 安装孔 / 主控竖放占位 / 模块排针焊盘（2.54）/ 电源母线（走廊布线）/ 尺寸标注 / 工艺参数与按面积报价；电机舵机等列为板外件 |
| 自由画板 | 模块可任意拖拽，连线实时重算（总线脊柱 + 短分支，不横穿节点）；单击看关联、双击取消；布局按方案签名存本机，换方案各存各的 |
| 视觉与动效 | 统一图标系统与品牌标识（favicon 全套 + PWA manifest）；路由切换淡入、卡片错峰入场、按钮光斑跟随、滚动进度条；接线图线束描边动画与悬停高亮（悬停模块即高亮对应线束、其余淡出）；3D 面板悬停光晕；全部动效支持系统「减少动态效果」偏好 |
| 选型热度 | 页脚 GitHub contribution 风格热力图，统计本机近 12 周真实选型操作（加模块 / 换基座 / 载入预设 / 生成方案 / 下单） |

## 目标用户

1. **高校电子类课程学生**——课程设计 / 电赛选型期，预设方案起步，校验规则避开电平烧 IO、电源带不动电机这些高频坑。
2. **嵌入式爱好者 / 创客**——散件合集快速验证「这块板带不带动这堆传感器」，引脚与 I2C 地址自动分配。
3. **小批量方案商 / 工作室**——出客户 demo：BOM 报价 + 接线图 + 分享链接，十分钟一份可评审选型单。

## 使用流程

浏览 / 搜索 → 定基座 → 加模块 → 看校验报告（全绿才下单）→ 生成并导出 / 分享方案。

## 校验规则（9 条）

| 级别 | 代码 | 规则 |
| --- | --- | --- |
| 错误 | E1 | 有模块无基座 |
| 错误 | E2 | I2C 地址 / 总线冲突（同总线同地址，如双 VL53L0X、0x29 撞车） |
| 错误 | E3 | 单 UART 基座上第二台串口设备 |
| 错误 | E4 | GPIO 余量不足（专用控制脚 + SPI 片选合计） |
| 错误 | E5 | 电源轨超载（3.3V / 5V / 外部轨按典型电流核算；外供负载无电源时拦截） |
| 警告 | W1 | 电源占用 ≥ 85% |
| 警告 | W2 | 逻辑电平错配（配 TXS0108 后自动转为通过） |
| 警告 | W3 | 峰值电流 ≥ 300mA 的电机 / GSM 负载 |
| 信息 | I1 | I2C 总线共享说明 / 空配置台提示 |

## 页面结构

`#/` 首页 · `#/explore` 模块库 · `#/build` 选型配置台（三栏）· `#/plan` 方案预览 · `#/guide` 平台指南（即产品规格说明）。

## 响应式

- **≥1280px**：配置台三栏并行，卡片网格自适应 ≥4 列
- **960–1279px**：两栏，校验面板下移通栏
- **720–959px**：单栏纵向流（选型区 → 模块库 → 校验报告），导航折叠
- **<720px**：卡片单列、底部常驻操作条（合计价 + 生成方案），触控目标 ≥40px
- **通用**：表格横向滚动、`prefers-reduced-motion` 关闭跑马灯、打印样式只留方案正文

## 支付接入（微信 / 支付宝）

静态站无法安全保存支付密钥，真实收款由独立网关处理（`server/` 目录，零依赖 Node）：

```
浏览器（选支付方式） → 支付网关 server/server.js → 微信 v3 Native / 支付宝当面付
       ↑ 轮询支付状态                        ← 异步回调 notify（验签/解密后标记已付）
```

**本地/演示运行**（未配密钥自动 mock，页面标注"模拟"）：

```bash
node server/server.js        # 站点 + 网关同端口 :8321
# 打开 http://127.0.0.1:8321  → 下单 → 支付弹窗出现（模拟）二维码
```

**接入真实通道**：申请微信支付商户号（Native 产品）与支付宝当面付签约后，设置环境变量：

| 变量 | 说明 |
| --- | --- |
| `WECHAT_MCHID` / `WECHAT_APPID` / `WECHAT_SERIAL_NO` | 商户号 / appid / API 证书序列号 |
| `WECHAT_KEY_PATH` / `WECHAT_APIV3_KEY` | 商户私钥 `apiclient_key.pem` / APIv3 密钥 |
| `ALIPAY_APP_ID` / `ALIPAY_PRIVATE_KEY_PATH` / `ALIPAY_PUBLIC_KEY_PATH` | 支付宝应用三件套 |
| `PUBLIC_BASE` | 对外域名（微信回调地址用），如 `https://pay.example.com` |

配置后重启网关，前端**无需改动**——`assets/pay-config.js` 的 `apiBase` 指向网关域名（同源部署可留空），支付弹窗自动从"模拟"切换为真实二维码并轮询到账；网关不可达时自动降级模拟。

⚠️ 前端订单状态存于浏览器 localStorage，网关用 `server/data/orders.json` 记录支付流水——演示规模够用，上生产请把网关订单落库并加对账。微信回调验签（平台证书轮换）与支付宝 `ALIPAY_STRICT_VERIFY=1` 严格验签建议上线前打开。

## 本地运行 / 停止

站点 + 支付网关由同一个 Node 进程承载，**一条命令跑全套**：

```bash
node server/server.js          # 默认 :8321，PORT=8400 node server/server.js 可改端口
```

不想用命令就用脚本（已实测）：

| 操作 | Windows | Git Bash / Linux / macOS |
| --- | --- | --- |
| 启动 | 双击 `start.bat`（自动起服务 + 开浏览器，服务在独立最小化窗口） | `./start.sh [端口]` |
| 停止 | 双击 `stop.bat`（按端口 8321 结束进程） | `./stop.sh [端口]` |

> 端口被占用时启动脚本会提示先运行停止脚本；也可 `PORT=8400` 换端口。
> 只要静态站（不需要支付 API）：`python -m http.server 8321`，但支付会走降级模拟。

## 部署

纯静态、零构建、哈希路由（无 404 回退问题）。两条主路径：

### GitHub Pages（push 自动发布）

仓库内已带 `.github/workflows/pages.yml`，流程是 **跑引擎测试 → 组装产物 → 发布**：

1. 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**（只需设一次）
2. 之后每次 `git push` 到 `main` 自动触发，也可在 Actions 页手动 `Run workflow`
3. 站点地址：`https://<用户名>.github.io/<仓库名>/`

workflow 只打包运行期文件（`index.html` / `assets/` / `site.webmanifest` / `.nojekyll`），
`server/`、测试文件不进产物；发布前会校验 `app-core.js`、`style-core.css`、`mod/manifest.js` 是否存在，
缺一个就失败，避免发出白屏站点。

> **私有仓库发布 Pages 需要付费账号**（Pro / Team / Enterprise）。免费账号只有 public 仓库能用 Pages。
> 想不花钱就用 public 仓库，或直接走下面的 Vercel —— Vercel 和 Cloudflare Pages 对私有仓库免费。

### Vercel（推荐给需要 preview 的场景）

**网页导入**：Vercel → Add New → Project → 选这个仓库 →
Framework Preset 选 **Other**，Build Command 留空，Output Directory 填 `.`，Deploy。
之后每次 push 自动生成 preview 与 production。

**CLI**：
```bash
npm i -g vercel
vercel          # 预览环境
vercel --prod   # 生产
```

仓库内的 `vercel.json` 做了三件事：

| 配置 | 作用 |
| --- | --- |
| `framework: null` + 空 build/output | 明确"这是纯静态站，别猜框架" |
| 缓存分级 | `assets/mod/*`（58 张产品图）与 `assets/icons/*` 缓存 30 天 immutable；`index.html` 与 js/css 走 `max-age=0, must-revalidate`，改完立刻生效 |
| 安全头 | `nosniff` / `SAMEORIGIN` / `strict-origin-when-cross-origin` / 关闭地理与摄像头权限 |

`.vercelignore` 把 `server/`、`_domtest.html`、`test-engine.js`、启动脚本排除在上传之外。

### Cloudflare Pages

连接 Git 仓库 → 构建命令留空 → 输出目录填 `/` → 保存部署。

### 静态托管的功能边界

选型 / 3D / 接线图 / 底板图 / 软件方案 / 画板 / 下单 / 后台全部可用。
**方案广场与真实支付**依赖 `server/` 网关（Node），静态托管下：

- 广场退化为本地方案列表
- 支付 `fetch` 失败后自动降级为**模拟支付**，页面会明确标注（`assets/pay.js` 的 catch 分支）

要开真实支付，把 `server/` 部署到 Railway / Render / VPS，然后把 `assets/pay-config.js` 的
`apiBase` 指向该域名即可，前端不用改。


## 说明

价格 / 电流 / GPIO 等参数为教学演示量级（参考常见淘宝定价与数据手册量级估算），非采购报价；电源供给按板载稳压能力简化建模。下单 / 支付 / 物流为前端模拟闭环，订单数据存于浏览器 localStorage，如需真实支付需自行接入服务端（可结合云函数 / Supabase 等）。
