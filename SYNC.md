# 双 Mac 同步指南（ForkedExtensions → ExtensionsMods）

> 本文件描述个人 fork 的多机同步工作流。所有个人改动都在 `my-mods` 等分支上，两台 Mac 通过 GitHub（`Caffeine19/extensions`）同步。

## 仓库与目录布局

| 路径                                           | 说明                                                          |
| ---------------------------------------------- | ------------------------------------------------------------- |
| `ExtensionsMods/`                             | `Caffeine19/extensions` 的 sparse clone，工作分支 `my-mods`   |
| `ExtensionsModsWorktrees/apple-photos-list-detail/` | `apl-list-detail` 分支的 git worktree（apple-photos 变体）    |
| `ForkedExtensions/`                            | **冻结备份**（迁移前的 15 个独立 fork，含全部历史；不要再改） |
| `ForkedExtensions-backup-2026-10-03.tar.gz`    | 迁移前的全量 tar 备份（752MB）                                |
| `ForkPatches/`                                | 迁移用的 patch 存档（审计用，可删）                           |

## 分支说明

- `my-mods` — 主线：14 个扩展的全部个人改动（上游 + 个人提交）
- `apl-list-detail` — apple-photos 变体：列表+详情预览、list/grid 切换
- `apl-no-compression` — apple-photos 变体：导出不压缩
- `apl-all-well` — apple-photos 变体：list-detail + no-compression 合体
- `wip/vscode-active-entries` — vscode 未完成的 active-entries 实验（仅存档）

## Mac B 首次搭建

```bash
# 1. GitHub 认证
gh auth login

# 2. 克隆（sparse + blob 过滤，无需拉全量 20GB）
cd /Volumes/Dev/Code/raycast   # 或任意目录，保持兄弟布局
git clone --filter=blob:none --sparse https://github.com/Caffeine19/extensions ExtensionsMods
cd ExtensionsMods
git sparse-checkout set extensions/apple-photos extensions/cling extensions/easy-new-file \
  extensions/hammerspoon extensions/imessage-2fa extensions/microsoft-edge extensions/notion \
  extensions/obsidian extensions/open-with-app extensions/surge extensions/shottr \
  extensions/spotify-player extensions/text-shortcuts extensions/visual-studio-code-recent-projects
git remote add upstream https://github.com/raycast/extensions
git checkout my-mods

# 3. apple-photos list-detail 变体（可选，与 Mac A 相同布局）
git worktree add ../ExtensionsModsWorktrees/apple-photos-list-detail apl-list-detail

# 4. 安装依赖并注册进 Raycast（每个扩展一次）
for d in extensions/*; do (cd "$d" && npm install --no-audit --no-fund && timeout 15 npm run dev || true); done
# npm run dev 启动后会把扩展导入 Raycast，几秒后 Ctrl-C 关掉即可；导入是持久的。
# 注意：hammerspoon 的 .node-version 要求 Node v24，其余 v22。

# 5. 删除 Raycast 里指向旧 ForkedExtensions 路径的 dev 扩展，避免重复条目
```

## 日常双端工作流

1. **开工前**：`git pull`（在 ExtensionsMods 内）
2. **收工前**：`git commit` + `git push`
3. 两台机器都会改代码 → 严格执行"先 pull 后改"，避免同文件并发编辑
4. apple-photos 变体的改动在对应 worktree 分支上提交，同样 push

## 新增扩展

### 情况 1：上游已有，想改它（最常见）

```bash
git fetch upstream
git merge upstream/main        # 在 my-mods 上
git sparse-checkout add extensions/<扩展名>   # 关键：不加则目录不会检出到本地
cd extensions/<扩展名> && npm install
timeout 15 npm run dev || true # 注册进 Raycast，几秒后 Ctrl-C
# 开发改动 → commit + push，之后进入日常同步循环
```

### 情况 2：上游没有，从零新建

1. Raycast 里新建扩展模板（或 `npx init-raycast` 脚手架），或手写 `package.json` + `src/`
2. 目录放到 `extensions/<扩展名>/`，同时把它加进 sparse-checkout 名单
3. `git add` + commit（作为新扩展提交）+ push
4. `cd extensions/<扩展名> && npm install && npm run dev` 注册测试

### 情况 3：需要独立实验分支

```bash
git worktree add ../ExtensionsModsWorktrees/<名字> <分支名>
# 在 worktree 里改，push 后按需合回 my-mods（同 apple-photos 变体）
```

> sparse-checkout 名单新增目录后，另一台 Mac 拉取时同样需要执行
> `git sparse-checkout add extensions/<扩展名>`，否则文件不会出现在工作目录。

## 更新上游（raycast/extensions）

```bash
git fetch upstream
git merge upstream/main   # 在 my-mods 上；冲突只出现在改过的扩展目录
npm install               # 每个受影响的扩展目录
git push
```

## 防膨胀：partial clone 懒加载与 GUI 自动 fetch（2026-11-22 事故）

本仓库是 `--filter=blob:none` 的 partial clone：本地只有提交和目录树，文件内容（blob）按需从
GitHub 懒加载。2026-11-22 凌晨 GitKraken 打开仓库约 40 分钟后，`.git/objects` 膨胀到约 500GB：

1. GitKraken 默认每 1 分钟自动 fetch 一次，且无视 `remote.*.fetch` 配置、一次拉全部分支
   （`FETCH_HEAD` 出现全部 13 个分支即为证据）；官方至今不支持 partial clone。
2. 渲染提交图 / commit diff / blame 需要文件内容 → 触发懒加载：每个对象起一个 `git fetch`
   子进程、连带下载被请求对象引用的一切、对象之间无 delta 压缩（Git 官方文档明示的低效路径）。
3. 松散对象来不及 `gc` 打包，体积进一步放大。

### 防复发清单

- [ ] **GitKraken → Preferences → General → Auto-Fetch Interval → 0**（应用级设置，只能手动；
      也不要在这个仓库里用 GitKraken 浏览提交图/历史 diff）
- [x] **VS Code 工作区 `.vscode/settings.json`** 已关闭 `git.autofetch`，随仓库提交、两台 Mac 共享
- [ ] 历史检索用命令行限定范围与路径：`git log -S x A..B -- path`，避免全历史 pickaxe
- [ ] 大批量操作后手动跑一次 `git maintenance run`
- [ ] 需要彻底禁止懒加载时：`git --no-lazy-fetch ...`（git ≥ 2.45）或 `GIT_NO_LAZY_FETCH=1`；
      代价是 pull/checkout 需要新 blob 时会直接失败，按需使用
- [ ] 磁盘暴涨时只清理按 mtime 确认属于自己的 `tmp_pack_*`；**不要手删整个 `.git/objects`**
      （会连未 push 的提交对象一起删掉）

## 提交规范

gitmoji 风格：`:sparkles: 新功能`、`:bug: 修 bug`、`:wrench: 杂项配置`、`:memo: 文档`、`:busts_in_silhouette: 贡献者`、`:fire: 删除`。
