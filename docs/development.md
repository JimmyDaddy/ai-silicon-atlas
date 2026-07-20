# 开发与维护指南

本文面向需要在本地运行、维护数据或部署智芯图谱的开发者。面向访客的产品介绍请查看仓库根目录的 [`README.md`](../README.md)。

## 技术栈

- Astro 静态站点
- TypeScript 与原生浏览器脚本
- Node.js 数据抓取、清洗和 AI 分析脚本
- GitHub Actions 定时更新与 GitHub Pages 部署

## 本地运行

```bash
npm install
npm run dev
```

默认访问地址为 `http://localhost:4321`。

提交前运行：

```bash
npm run data:validate
npm run analysis:validate
npm run news:validate
npm run check
npm run build
```

## 更新数据与 AI 分析

```bash
npm run data:update
npm run data:validate
npm run analysis:update
npm run analysis:validate
npm run news:update
npm run news:validate
```

常用环境变量：

| 名称 | 类型 | 用途 |
| --- | --- | --- |
| `DATA_CONTACT_EMAIL` | GitHub Variable | SEC 请求使用的联系人邮箱 |
| `DART_API_KEY` | GitHub Secret | 韩国 OpenDART 接口密钥 |
| `AI_BASE_URL` | GitHub Variable | 可选的 OpenAI 兼容接口地址 |
| `AI_MODEL` | GitHub Variable | 可选的模型覆盖值 |
| `AI_MAX_COMPANIES` | GitHub Variable | 每次最多分析公司数，默认 8 |
| `NEWS_AI_MAX_ARTICLES` | GitHub Variable | 每次最多分析新增情报数，默认 8 |
| `AI_API_KEY` | GitHub Secret | 使用自定义 AI 服务时的密钥 |

未配置自定义 AI 服务时，GitHub Actions 使用自带的 `GITHUB_TOKEN`、`models: read` 权限和 `openai/gpt-4.1-mini`。本地未配置令牌时，脚本只更新分析状态，不会伪造模型输出。

完整数据结构、证据引用和失败回退策略见 [`data-pipeline.md`](data-pipeline.md)。

## GitHub Pages 部署

仓库包含两个工作流：

- `.github/workflows/deploy.yml`：`main` 更新时构建并部署静态站点。
- `.github/workflows/update-data.yml`：每天 UTC 02:17 抓取数据、生成分析、校验、提交快照并部署。

仓库 Pages 设置需要选择 **GitHub Actions** 作为部署来源。默认站点地址为 `https://silicon-atlas.timetombs.today`，`public/CNAME` 会包含在构建产物中。

临时构建其他域名或子路径时可以设置：

```bash
SITE_URL=https://example.com BASE_PATH=/preview/ npm run build
```

## 内容位置

| 内容 | 路径 |
| --- | --- |
| 公司基础资料 | `src/data/companies.ts` |
| 公司抓取标识 | `src/data/company-identifiers.json` |
| 公司研究档案 | `src/data/company-profiles.ts` |
| 产业关系图 | `src/data/industry-map.ts` |
| 产业环节 | `src/data/stages.ts` |
| 数据适配器 | `scripts/providers/` |
| 自动生成数据 | `src/data/generated/company-updates.json` |
| 自动生成 AI 分析 | `src/data/generated/company-analysis.json` |
| 权威情报源与重点文章 | `src/data/news-sources.json` |
| 自动生成综合情报 | `src/data/generated/news.json` |
| AI 消费导出构建器 | `src/lib/ai-export.ts` |
| JSON / Markdown / llms.txt 端点 | `src/pages/exports/`、`src/pages/llms.txt.ts` |
| 页面 | `src/pages/` |
| 全局样式 | `src/styles/global.css` |

## 品牌与分享图片

- 页面 Logo 与 favicon 共用 `public/favicon.svg`。
- Apple Touch Icon 位于 `public/apple-touch-icon.png`。
- Open Graph 与仓库 Social Preview 成品位于 `public/social-preview.png`。
- 可编辑的分享图构图文件与底图分别为 `assets/brand/social-preview.svg` 和 `assets/brand/social-preview-bg.png`。

GitHub 仓库自身的 Social Preview 需要在仓库 **Settings → General → Social preview** 中上传 `public/social-preview.png`；站点页面已经通过 Open Graph 元数据自动引用该图片。
