# Starloom

> Weave your stars into order.

Starloom 是一个 local-first 的 GitHub Stars 管理器。它通过 GitHub API 同步收藏，并在浏览器本地完成搜索、批量分组、标签、规则分类和清理。

## 第一版功能

- 使用 GitHub Personal Access Token 连接账号
- 分页拉取全部 Stars，并保留本地分类后增量同步
- 全文搜索、语言筛选、收藏时间/活跃时间/Stars 排序
- Inbox、Archived、三年未更新等智能视图
- 自定义分组，一个仓库可以加入多个分组
- 跨页批量选择、批量分组、批量添加标签
- 基于语言、Topics 和简介的自动分类
- 批量 Unstar，执行前预览，逐项提交并显示进度
- IndexedDB 本地持久化
- JSON 备份与恢复

## 开始使用

```bash
npm install
npm run dev
```

打开终端输出的本地地址，输入 GitHub Personal Access Token 后进行首次同步。

Token 保存在当前浏览器的 `localStorage`，仓库和分类数据保存在 IndexedDB。不要在不受信任或多人共用的浏览器环境中使用长期 Token。建议创建最小权限 Token，并设置有效期。

## 自动分类规则

第一版内置 Vue、React、Electron、Uni-app、Micro Frontend、AI、Styles & UI、Dev Tools 和 Client 规则。规则只会添加本地分组，不会自动取消 Star。

规则位于 `src/services/classifier.ts`，可以直接调整关键词和颜色。

## 验证

```bash
npm run build
```

## 技术栈

- Vue 3 + TypeScript + Vite
- Pinia
- Octokit
- Dexie / IndexedDB

## 当前边界

GitHub 官方 API 可以稳定读取 Stars 和执行 Star/Unstar，但 GitHub Lists 缺少适合批量写入的稳定公开接口。因此 Starloom 第一版使用本地分组作为分类数据源，不会写入 GitHub Lists。
