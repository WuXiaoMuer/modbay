/* ============ MODBAY 视图：平台指南（规格说明） ============ */
(function () {
  "use strict";
  var M = window.M;

  function doc(h3, label, body) {
    return '<div class="doc-card"><h3>' + h3 + ' <span class="mono">' + label + "</span></h3>" + body + "</div>";
  }

  function viewGuide() {
    var users = doc("目标用户", "WHO", "" +
      '<ul><li><b>高校电子类课程学生</b> —— 课程设计 / 电赛选型期，用预设方案快速起步，用校验规则避开学长踩过的坑（电平烧 IO、电源带不动电机）。</li>' +
      "<li><b>嵌入式爱好者与创客</b> —— 手里一堆散件，想确认「这块板带不带动这堆传感器」，引脚分配和 I2C 地址分配自动算好。</li>" +
      "<li><b>小批量方案商 / 工作室</b> —— 给客户出方案 demo：BOM 报价、接线示意图、分享链接，十分钟一份可评审的选型单。</li></ul>");

    var flow = doc("使用流程", "FLOW", "" +
      "<ol>" +
      "<li><b>浏览或搜索</b> —— 进入「模块库」，按六大类 / 关键词 / 价格 / 电流筛选，卡片看全部关键参数。</li>" +
      "<li><b>先定基座</b> —— 在配置台选定主控板（决定 IO 电平、GPIO 数量、电源轨容量），也可从预设方案一键载入。</li>" +
      "<li><b>加功能模块</b> —— 点「+ 加入配置台」，或在配置台用 ± 调数量，BOM 合计即时更新。</li>" +
      "<li><b>看校验报告</b> —— 右侧面板红 / 黄 / 绿三档：错误必须解决，警告建议处理，全部绿色才能放心下单。</li>" +
      "<li><b>生成方案</b> —— 方案页输出接线示意 + 引脚表 + 电源预算 + BOM，可导出 JSON / 复制清单 / 分享链接。</li>" +
      "<li><b>下单付款</b> —— 方案页「下单购买」填收货信息 → 我的订单内模拟支付（真实通道下为微信 / 支付宝扫码）。</li>" +
      "<li><b>后台处理</b> —— 付款后后台自动备货 / 发货（演示控制台可手动推进）；订单全程留轨迹。</li>" +
      "</ol>");

    var sitemap = doc("页面结构", "SITEMAP", "" +
      "<ul>" +
      "<li><span class='pill'>#/</span> 首页 —— 主张、数据概览、四步能力、预设方案入口</li>" +
      "<li><span class='pill'>#/explore</span> 模块库 —— 分类 / 搜索 / 排序、参数卡片</li>" +
      "<li><span class='pill'>#/build</span> 选型配置台 —— 三栏：模块库 · 基座与选型区 · 校验与 BOM</li>" +
      "<li><span class='pill'>#/plan</span> 方案预览 —— 校验报告、接线示意图、引脚分配表、电源预算表、BOM、导出/分享</li>" +
      "<li><span class='pill'>#/plan/:id</span> 广场方案页 —— 作者归属、点赞、改一改、直达下单</li>" +
      "<li><span class='pill'>#/checkout</span> 下单 —— 收货信息 + 支付方式 + 订单摘要</li>" +
      "<li><span class='pill'>#/orders</span> 我的订单 —— 支付 / 取消 / 订单轨迹 / 导出</li>" +
      "<li><span class='pill'>#/admin</span> 演示后台 —— 订单统计、状态筛选、履约推进、导出</li>" +
      "<li><span class='pill'>#/plaza</span> 方案广场 —— 发布 / 最热·最新 / 点赞 / Remix / 打开下单</li>" +
      "<li><span class='pill'>#/guide</span> 本页 —— 产品规格说明</li>" +
      "</ul>");

    var inter = doc("交互方式", "INTERACTION", "" +
      "<ul>" +
      "<li><b>点击添加</b> —— 卡片「+ 加入配置台」，无需拖拽，触屏可用；数量用 ± 按钮调整。</li>" +
      "<li><b>即时校验</b> —— 任何增删改模块操作后，右侧检查面板、电源条、引脚表全部实时重算。</li>" +
      "<li><b>预设载入</b> —— 首页 / 配置台一键载入四套模板方案，载入后可继续编辑。</li>" +
      "<li><b>本地持久化</b> —— 选型进度、订单、支付流水存 localStorage，刷新 / 关页面不丢。</li>" +
      "<li><b>方案分享</b> —— 方案编码进 URL hash，复制链接即可还原整个配置。</li>" +
      "<li><b>3D 装配预览</b> —— 45+ 种模块按真实零件建模（排针、屏蔽罩、散热片、超声波双探头、18650 电芯、车轮…），按实测尺寸落在板面带接触阴影与丝印；拖拽旋转 / 滚轮缩放 / 点击模块看参数，电源件外挂地面并连线入板。</li>" +
      "<li><b>支付弹窗</b> —— 真实通道出二维码 + 2.5s 轮询到账；未配置网关自动降级模拟支付，界面明确标注。</li>" +
      "<li><b>选型热度</b> —— 页脚热力图统计本机近 12 周真实操作（加模块 / 换基座 / 载入预设 / 生成方案 / 下单）。</li>" +
      "<li><b>后台履约</b> —— 付款后自动备货 → 发货；演示控制台支持手动 / 批量推进与导出。</li>" +
      "<li><b>主题切换</b> —— 右上角按钮在暗色 / 亮色间切换并记忆选择。</li>" +
      "</ul>");

    var rules = doc("校验规则", "RULES", "" +
      "<ul>" +
      "<li><b>E1 基座缺失</b> —— 有模块无主控，红色拦截。</li>" +
      "<li><b>E2 I2C 地址/总线</b> —— 同总线地址冲突（如双 BMP280、VL53L0X 与 TCS34725 同抢 0x29）自动报错并提示改址。</li>" +
      "<li><b>E3 串口占用</b> —— 单 UART 基座上第二台串口设备拦截。</li>" +
      "<li><b>E4 GPIO 余量</b> —— 专用控制脚 + SPI 片选合计超过可用 IO 时拦截。</li>" +
      "<li><b>E5 电源轨超载</b> —— 3.3V / 5V / 外部轨按典型电流核算，外供负载无电源时拦截。</li>" +
      "<li><b>W1 电源吃紧</b> —— 占用 ≥ 85% 预算时黄色预警（留峰值余量）。</li>" +
      "<li><b>W2 逻辑电平</b> —— 5V 传感器接 3.3V 板（或反之）黄色预警；配置 TXS0108 后自动转为通过。</li>" +
      "<li><b>W3 峰值电流</b> —— 舵机 / 电机 / GSM 等峰值 ≥ 300mA 负载预警，提示独立供电。</li>" +
      "<li><b>I1 信息项</b> —— I2C 总线共享说明、空配置台提示。</li>" +
      "</ul>");

    var resp = doc("响应式要求", "RESPONSIVE", "" +
      "<ul>" +
      "<li><b>≥ 1280px（桌面宽）</b> —— 配置台三栏并行：模块库 / 选型区 / 校验面板，模块卡片网格 ≥ 4 列。</li>" +
      "<li><b>960–1279px</b> —— 配置台两栏，校验面板下移通栏；模块卡片 2–3 列；首页特性卡两列。</li>" +
      "<li><b>720–959px</b> —— 单栏纵向流：选型区优先、模块库随后、校验报告收尾；导航折叠为主操作按钮。</li>" +
      "<li><b>&lt; 720px（手机）</b> —— 卡片单列、筛选条换行全宽搜索、底部常驻操作条（合计价 + 生成方案按钮），触控目标 ≥ 40px。</li>" +
      "<li><b>通用</b> —— 表格横向滚动、字号随断点微调、prefers-reduced-motion 下关闭跑马灯、打印样式隐藏导航只留方案正文。</li>" +
      "</ul>");

    var stack = doc("实现说明", "STACK", "" +
      "<ul>" +
      "<li>纯静态三件套：HTML / CSS / 原生 JS，哈希路由 SPA，零构建、零依赖，双击 index.html 即可运行。</li>" +
      "<li>数据驱动：assets/data-*.js 共 " + (M.BOARDS.length + M.MODULES.length) + " 件商品，增删商品只改数据文件。</li>" +
      "<li>视觉：参考 ArtCraft 设计 token（Archivo / Geist Mono，#121316×#2d81ff，扫描线质感）+ GitHub 深色极客气质；PCB / 接线示意图均由代码生成，无外部素材。</li>" +
      "<li>部署：GitHub Pages（含 .nojekyll）/ Vercel（vercel.json）/ Cloudflare Pages 三平台零构建直传；hash 路由无 404。</li>" +
      "<li>支付预留：assets/pay.js 适配层 + server/ 零依赖网关（微信 v3 Native / 支付宝当面付，env 门控），未配商户证书自动 mock。</li>" +
      "<li>价格 / 电流 / GPIO 为教学演示量级，非 BOM 采购报价。</li>" +
      "</ul>");

    var pay = doc("支付与部署", "PAY · DEPLOY", "" +
      "<ul>" +
      "<li><b>链路</b>：浏览器选支付方式 → 支付网关（server/server.js）→ 微信 v3 Native / 支付宝当面付；异步回调验签（解密）后标记已付，前端轮询到账。</li>" +
      "<li><b>降级</b>：未配商户证书或网关不可达 → 自动模拟支付，界面标注「模拟」。密钥只走服务端，前端零暴露。</li>" +
      "<li><b>开通</b>：微信支付商户号（Native）+ 支付宝当面付签约，按 README 表格配置环境变量，前端零改动。</li>" +
      "<li><b>部署</b>：GitHub Pages（含 .nojekyll）、Vercel（vercel.json）、Cloudflare Pages——均零构建，hash 路由免 rewrite。</li>" +
      "</ul>");

    return '<div class="sec-head"><span class="sec-label">PLATFORM GUIDE</span>' +
      '<h2 class="sec-title">平台规格说明</h2>' +
      '<p class="sec-desc">写给评审者：这个平台给谁用、怎么用、页面怎么组织、屏幕怎么自适应。</p></div>' +
      '<div class="guide-grid">' + users + flow + sitemap + inter + rules + resp + pay + stack + "</div>";
  }

  window.MODBAY_VIEW_GUIDE = viewGuide;
})();
