# 数据更新流水线

本站使用 GitHub Actions 在纯静态架构下完成数据更新。网页不会携带任何 API 密钥。

## 更新流程

1. `.github/workflows/update-data.yml` 每天 UTC 02:17 定时运行，也支持手动触发。
2. `scripts/update-data.mjs` 调用各官方数据适配器。
3. 适配器将不同市场的数据整理为统一的公司快照。
4. `scripts/validate-data.mjs` 校验时间、状态、指标和链接。
5. Astro 类型检查和静态构建必须通过。
6. 快照发生变化时，由 `github-actions[bot]` 提交到 `main`。
7. 数据更新工作流直接发布刚构建的 Pages artifact；普通的 `main` 提交仍由独立部署工作流处理。

定时任务使用的 `GITHUB_TOKEN` 所产生的普通 `push` 不会再次触发另一个工作流，因此定时数据工作流包含自己的部署 job，确保抓取、提交与上线闭环完成。

如果一次远端请求失败，更新器会保留该公司的上一次成功快照并标记 `stale: true`，避免临时网络故障清空线上数据。

## 当前适配器

### SEC EDGAR

- 自动解析 ticker → CIK。
- 获取最新 10-K、10-Q、8-K、20-F 或 6-K。
- 从 Company Facts XBRL 中提取最新收入、净利润、资产、现金和资本开支。
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

## 行情数据边界

公开展示或再分发行情通常需要商业授权。仓库不默认接入个人用途或许可不明的数据源。取得供应商授权后，应在 `scripts/providers/` 新增服务端 CI 适配器，并将密钥放入 GitHub Actions secrets。

## 本地运行

```bash
npm run data:update
npm run data:validate
npm run check
npm run build
```
