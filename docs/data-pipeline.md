# 数据更新流水线

本站使用 GitHub Actions 在纯静态架构下完成数据更新。网页不会携带任何 API 密钥。

## 更新流程

1. `.github/workflows/update-data.yml` 每天 UTC 02:17 定时运行，也支持手动触发。
2. `scripts/update-data.mjs` 调用各官方数据适配器。
3. 适配器将不同市场的数据整理为统一的公司快照、最近披露列表和最多 8 个历史指标期。
4. `scripts/analyze-data.mjs` 对比输入哈希，为发生变化的公司构造证据包并生成 AI 综合分析。
5. `scripts/validate-data.mjs` 和 `scripts/validate-analysis.mjs` 校验数据、历史顺序、分析结构和证据引用。
6. Astro 类型检查和静态构建必须通过。
7. 快照发生变化时，由 `github-actions[bot]` 提交到 `main`。
8. 数据更新工作流直接发布刚构建的 Pages artifact；普通的 `main` 提交仍由独立部署工作流处理。

定时任务使用的 `GITHUB_TOKEN` 所产生的普通 `push` 不会再次触发另一个工作流，因此定时数据工作流包含自己的部署 job，确保抓取、提交与上线闭环完成。

如果一次远端请求失败，更新器会保留该公司的上一次成功快照并标记 `stale: true`，避免临时网络故障清空线上数据。

## 当前适配器

### SEC EDGAR

- 自动解析 ticker → CIK。
- 获取最新 10-K、10-Q、8-K、20-F 或 6-K。
- 保留最近 8 条官方披露。
- 从 Company Facts XBRL 中提取收入、净利润、资产、现金和资本开支，并保留最多 8 个历史期。
- 请求包含可识别的 User-Agent，并限制请求节奏。

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

## 行情数据边界

公开展示或再分发行情通常需要商业授权。仓库不默认接入个人用途或许可不明的数据源。取得供应商授权后，应在 `scripts/providers/` 新增服务端 CI 适配器，并将密钥放入 GitHub Actions secrets。

## 本地运行

```bash
npm run data:update
npm run data:validate
npm run analysis:update
npm run analysis:validate
npm run check
npm run build
```
