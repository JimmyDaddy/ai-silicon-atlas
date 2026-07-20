# 数据更新流水线

本站使用 GitHub Actions 在纯静态架构下完成数据更新。网页不会携带任何 API 密钥。

## 更新流程

1. `.github/workflows/update-data.yml` 每天 UTC 02:17 定时运行，也支持手动触发。
   抓取任务使用 GitHub 托管的 macOS Runner，以避开 SEC 对部分共享 Linux 云出口的持续 403；Pages 部署仍使用 Ubuntu Runner。
2. `scripts/update-data.mjs` 调用各官方数据适配器。
3. 适配器将不同市场的数据整理为统一的公司快照、最近披露列表和最多 8 个历史指标期。
4. `scripts/analyze-data.mjs` 对比输入哈希，为发生变化的公司构造证据包并生成 AI 综合分析。
5. `scripts/update-news.mjs` 拉取权威来源 RSS、合并重点文章清单、去重分类，并为新增情报生成 AI 摘要。
6. `scripts/generate-delta.mjs` 对比更新前的 Git 快照，生成只包含本轮变化的 `delta.json`。
7. `scripts/generate-health.mjs` 汇总来源状态、数据新鲜度、AI 积压和独立来源占比，生成 `health.json`。
8. 数据、公司分析、情报、增量与健康快照分别通过专用校验脚本；健康达到 `critical` 时在 CI 中生成告警注解和运行摘要，但保留部署旧快照的能力。
9. Astro 类型检查和静态构建必须通过。
10. 快照发生变化时，由 `github-actions[bot]` 提交到 `main`。
11. 数据更新工作流直接发布刚构建的 Pages artifact；普通的 `main` 提交仍由独立部署工作流处理。

定时任务使用的 `GITHUB_TOKEN` 所产生的普通 `push` 不会再次触发另一个工作流，因此定时数据工作流包含自己的部署 job，确保抓取、提交与上线闭环完成。

如果一次远端请求失败，更新器会保留该公司的上一次成功快照并标记 `stale: true`，避免临时网络故障清空线上数据。

## 当前适配器

### SEC EDGAR

- 仓库登记 ticker → CIK，避免每轮同步依赖全量 ticker 清单；新增公司缺少 CIK 时才回退到官方清单解析。
- 获取最新 10-K、10-Q、8-K、20-F 或 6-K。
- 保留最近 8 条官方披露。
- 从 Company Facts XBRL 中提取收入、净利润、资产、现金和资本开支，并保留最多 8 个历史期。
- 请求包含可识别的 User-Agent，限制请求节奏，并对 403、429 和 5xx 做退避重试。
- 连续出现 3 次 403 时触发本轮熔断，快速结束其余请求并保留上一版快照；健康报告会把来源降级或中断显式展示。

建议在 GitHub 仓库变量中配置：

- `DATA_CONTACT_EMAIL`：SEC 请求 User-Agent 的维护者联系邮箱。

### OpenDART

- 获取韩国公司的最新官方披露。
- 未配置密钥时输出 `unconfigured`，不会导致整个更新失败。

需要在 GitHub Actions secrets 中配置：

- `DART_API_KEY`

### 其他市场

目前保留第一方投资者关系页面并标记为 `manual`。新增市场适配器时，应保持现有输出结构，不要在浏览器端直接请求带密钥的接口。

## AI 综合分析

默认通过 GitHub Models 的 Chat Completions 接口运行，使用 Actions 自动提供的 `GITHUB_TOKEN` 和 `models: read` 权限，默认模型为低速率限制等级的 `openai/gpt-4.1-mini`。也可以通过 `AI_BASE_URL`、`AI_MODEL` 和 `AI_API_KEY` 切换到兼容服务。

分析输入不包含抓取时间等易变字段，只包含公司标识、最新与最近披露、指标快照、历史变化和证据 URL。输入哈希未变化时不会再次调用模型。

模型必须输出固定 JSON 结构：

- 综合摘要及证据 ID
- 发生的变化
- 经营与财务信号
- 对价值链的可能影响
- 不确定性与分析边界
- 下一期待验证问题
- 置信度

`scripts/validate-analysis.mjs` 会拒绝未知证据引用或不完整输出。模型调用失败时保留上一次成功结果并标记为过期；模型未配置或公司缺少结构化证据时，页面显示对应状态而不会伪造分析。

## 权威情报聚合

`src/data/news-sources.json` 分成两类来源：

- 可稳定定时抓取的官方 RSS，例如 BIS、ECB、美国联邦储备系统研究、NIST、NVIDIA、Microsoft、AWS 与 Intel。
- 由维护者核验的重点机构文章，例如 BIS Bulletin、IMF Notes、IEA 分析和 Blackstone 官方观点。重点清单只保存链接、元数据与短要点，不复制文章全文。

更新器按 AI、半导体、数据中心、电力、模型平台、企业应用、资本市场和供应链关键词筛选，再关联到站内产业环节与公司。URL 去重后最多保留 120 篇，单个 Feed 每次检查最近 30 项；自动源失败时保留该来源的上一版内容。

新闻 AI 输入只包含标题、来源类型、官方 Feed 摘要或人工核验后的短要点。输出包括中文标题、综合摘要、重要性、价值链影响、不确定性和置信度。没有成功模型输出时，页面明确显示“AI 待处理”并退回来源摘要；不会把编辑要点冒充 AI 结果。

“全网覆盖”表示对可持续维护的权威来源进行扩展，不表示抓取所有转载站、社交媒体或付费研报。新增来源时优先使用官方 RSS，并在 `news-sources.json` 标注来源类型与优先级。

## AI 消费导出

每次 Astro 静态构建都会同步生成四个无需密钥的机器入口：

- `/exports/atlas.json`：完整价值链、研究主题、公司、官方快照、AI 分析和权威情报。
- `/exports/atlas.md`：适合直接注入长上下文或导入知识库的 Markdown 摘要。
- `/exports/delta.json`：只包含最近一次更新产生的披露、指标、分析和情报变化，适合每日 Agent 增量消费。
- `/llms.txt`：站点说明、核心页面和机器导出入口。

导出不复制外部文章全文，只包含本站摘要、分析状态、依据类型和原始来源 URL。消费方应保留这些来源字段，并在高风险结论前回到原文核验。

## 行情数据边界

公开展示或再分发行情通常需要商业授权。仓库不默认接入个人用途或许可不明的数据源。取得供应商授权后，应在 `scripts/providers/` 新增服务端 CI 适配器，并将密钥放入 GitHub Actions secrets。

## 本地运行

```bash
npm run data:update
npm run data:validate
npm run analysis:update
npm run analysis:validate
npm run news:update
npm run news:validate
npm run delta:update
npm run delta:validate
npm run health:update
npm run health:validate
npm run check
npm run build
```
