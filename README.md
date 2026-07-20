# 智芯图谱 AI & Silicon Atlas

一个部署在 GitHub Pages 上的中文 AI 与半导体产业情报网站。网站以交互式价值链地图为导航，整理全球代表性上市公司、官方披露、历史指标、研究档案和证据驱动的 AI 综合分析。

线上地址：<https://silicon-atlas.timetombs.today>

## 本地开发

```bash
npm install
npm run dev
```

质量检查与静态构建：

```bash
npm run check
npm run build
```

## 数据更新

数据抓取、清洗和校验代码与网站放在同一仓库中。默认数据源为 SEC EDGAR，公司官网与投资者关系入口作为人工维护的数据源；配置 `DART_API_KEY` 后还会同步韩国 OpenDART 披露。

```bash
npm run data:update
npm run data:validate
npm run analysis:update
npm run analysis:validate
```

`.github/workflows/update-data.yml` 每天定时运行数据管线，校验并构建网站，生成结果发生变化时提交数据与 AI 分析快照。SEC 建议通过仓库变量 `DATA_CONTACT_EMAIL` 配置请求联系人邮箱，OpenDART 密钥放入同名仓库 Secret。

AI 默认使用 GitHub Models 和 Actions 自带的 `GITHUB_TOKEN`，工作流只需要 `models: read` 权限，不需要额外密钥。默认模型为 `openai/gpt-4.1`；如需切换兼容服务，可配置：

- 仓库变量 `AI_BASE_URL`
- 仓库变量 `AI_MODEL`
- 仓库变量 `AI_MAX_COMPANIES`（每批最多分析公司数，默认 8）
- 仓库 Secret `AI_API_KEY`

AI 只分析发生变化的结构化证据包，并保存模型、Prompt 版本、输入哈希、证据引用和置信度。它不会生成评级、目标价或买卖建议。

完整的数据结构、失败回退策略与扩展方式见 [`docs/data-pipeline.md`](docs/data-pipeline.md)。

## GitHub Pages 部署

仓库已经包含 `.github/workflows/deploy.yml`。将代码推送到 GitHub 后：

1. 打开仓库的 **Settings → Pages**。
2. 在 **Build and deployment → Source** 中选择 **GitHub Actions**。
3. 推送到 `main`，或在 Actions 页面手动运行 `Deploy to GitHub Pages`。

项目默认以自定义域名 `https://silicon-atlas.timetombs.today` 和根路径 `/` 构建，`public/CNAME` 会随静态产物发布。临时预览其他域名时可通过 `SITE_URL` 和 `BASE_PATH` 覆盖默认值。

## 内容维护

- 公司资料：`src/data/companies.ts`
- 公司标识与抓取配置：`src/data/company-identifiers.json`
- 数据抓取适配器：`scripts/providers/`
- 自动生成数据：`src/data/generated/company-updates.json`
- 自动生成 AI 分析：`src/data/generated/company-analysis.json`
- 公司研究档案：`src/data/company-profiles.ts`
- 产业关系图：`src/data/industry-map.ts`
- 产业环节：`src/data/stages.ts`
- 页面：`src/pages/`
- 全局样式：`src/styles/global.css`

所有内容仅用于信息整理与学习，不构成证券研究报告或投资建议。
