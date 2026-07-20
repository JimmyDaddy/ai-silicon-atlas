# 智芯图谱 AI & Silicon Atlas

一个部署在 GitHub Pages 上的中文 AI 与半导体产业投资信息网站。网站以价值链为导航，整理全球代表性上市公司、关键技术环节和研究线索。

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
```

`.github/workflows/update-data.yml` 每天定时运行数据管线，校验并构建网站，只有生成结果发生变化时才提交 `src/data/generated/company-updates.json`。SEC 建议通过仓库变量 `DATA_CONTACT_EMAIL` 配置请求联系人邮箱，OpenDART 密钥放入同名仓库 Secret。

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
- 产业环节：`src/data/stages.ts`
- 页面：`src/pages/`
- 全局样式：`src/styles/global.css`

所有内容仅用于信息整理与学习，不构成证券研究报告或投资建议。
