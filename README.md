# Starloom

> GitHub 原生 Lists 的批量整理与自动分类工具。

Starloom 是面向 **GitHub 原生 Lists** 的批量整理工作台。它同步 Stars 与 Lists，通过本地规则生成可预览的分类结果，并在确认后写回 GitHub。

## 核心定位

Starloom 要解决的问题很具体：GitHub Lists 可以整理 Stars，但原生界面缺少高效的批量选择、规则分类和变更预览。

核心工作流：

```text
同步 GitHub Stars 与原生 Lists
            ↓
搜索、筛选与规则分类
            ↓
预览 Lists 批量变更
            ↓
逐项合并写回 GitHub Lists
            ↓
重新同步并校验结果
```

产品中的数据职责：

- **GitHub Lists**：真实分类数据源，最终结果通过 GraphQL API 写回 GitHub。
- **本地规则**：自动分类逻辑，可解释仓库为什么命中某个 List。
- **本地缓存**：提高搜索和批量操作速度，并保留尚未迁移的旧分组。
- **本地标签**：承载 GitHub Lists 不适合表达的多维信息，不替代原生 Lists。

## 当前版本

当前版本已经完成 Stars 与原生 Lists 管理闭环：

- 使用 GitHub Personal Access Token 连接账号
- 分页拉取全部 Stars、原生 Lists 及每个 List 的仓库
- 全文搜索、语言筛选、收藏时间/活跃时间/Stars 排序
- Inbox、Archived、三年未更新等智能视图
- 创建、编辑、删除 GitHub 原生 Lists，支持描述和公开/私有状态
- 将旧版本本地分组发布为 GitHub 原生 Lists
- 跨页批量选择、批量分组、批量添加标签
- 批量加入/移出 List 前预览影响范围
- 基于语言、Topics 和简介的自动分类
- 按完整 `listIds` 合并写回，避免覆盖仓库已有的其他 Lists
- 导出 Markdown 格式的 Lists 备份并直达 GitHub Stars
- 批量 Unstar，执行前预览，逐项提交并显示进度
- IndexedDB 本地持久化
- JSON 备份与恢复

所有批量 List 归属变更都会先展示仓库范围，确认后才逐项写入 GitHub。

## GitHub Lists GraphQL API

Starloom 使用 GitHub 公开 GraphQL schema 中的原生 Lists 能力：

- `User.lists`：读取用户 Lists
- `UserList.items`：读取 List 中的仓库
- `createUserList`：创建 List
- `updateUserList`：修改 List
- `deleteUserList`：删除 List
- `updateUserListsForItem`：更新仓库所属 Lists

字段与输入定义见 [GitHub GraphQL Reference · UserList](https://docs.github.com/en/graphql/reference#userlist)。

`updateUserListsForItem` 接收仓库最终所属的完整 `listIds`，不是单个 List 的增量操作。Starloom 在每次写入前基于同步结果合并目标 List，保留仓库已有的其他原生 Lists。

GitHub 仍将 Lists 标记为 Public Preview，schema 后续可能发生变化。如果写入失败，已成功的项目会保留在本地，重新同步即可按 GitHub 实际状态校准。

## 开始使用

```bash
npm install
npm run dev
```

打开终端输出的本地地址，输入 GitHub Personal Access Token 后进行首次同步。

Token 保存在当前浏览器的 `localStorage`，仓库和分类数据保存在 IndexedDB。不要在不受信任或多人共用的浏览器环境中使用长期 Token。建议创建最小权限 Token，并设置有效期。

## 自动分类规则

内置 Vue、React、Electron、Uni-app、Micro Frontend、AI、Styles & UI、Dev Tools 和 Client 规则。自动分类会先确认，再创建缺失的原生 Lists 并合并仓库归属；不会取消 Star。

规则位于 `src/services/classifier.ts`，可以直接调整关键词和颜色。

## 技术栈

- Vue 3 + TypeScript + Vite
- Pinia
- Octokit
- Dexie / IndexedDB

## 验证

```bash
npm run build
```
