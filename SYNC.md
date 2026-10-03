# 双 Mac 同步指南（ForkedExtensions → extensions-mods）

> 本文件描述个人 fork 的多机同步工作流。所有个人改动都在 `my-mods` 等分支上，两台 Mac 通过 GitHub（`Caffeine19/extensions`）同步。

## 仓库与目录布局

| 路径 | 说明 |
| --- | --- |
| `extensions-mods/` | `Caffeine19/extensions` 的 sparse clone，工作分支 `my-mods` |
| `extensions-mods-wt/apple-photos-list-detail/` | `apl-list-detail` 分支的 git worktree（apple-photos 变体） |
| `ForkedExtensions/` | **冻结备份**（迁移前的 15 个独立 fork，含全部历史；不要再改） |
| `ForkedExtensions-backup-2026-10-03.tar.gz` | 迁移前的全量 tar 备份（752MB） |
| `fork-patches/` | 迁移用的 patch 存档（审计用，可删） |

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
git clone --filter=blob:none --sparse https://github.com/Caffeine19/extensions extensions-mods
cd extensions-mods
git sparse-checkout set extensions/apple-photos extensions/cling extensions/easy-new-file \
  extensions/hammerspoon extensions/imessage-2fa extensions/microsoft-edge extensions/notion \
  extensions/obsidian extensions/open-with-app extensions/surge extensions/shottr \
  extensions/spotify-player extensions/text-shortcuts extensions/visual-studio-code-recent-projects
git remote add upstream https://github.com/raycast/extensions
git checkout my-mods

# 3. apple-photos list-detail 变体（可选，与 Mac A 相同布局）
git worktree add ../extensions-mods-wt/apple-photos-list-detail apl-list-detail

# 4. 安装依赖并注册进 Raycast（每个扩展一次）
for d in extensions/*; do (cd "$d" && npm install --no-audit --no-fund && timeout 15 npm run dev || true); done
# npm run dev 启动后会把扩展导入 Raycast，几秒后 Ctrl-C 关掉即可；导入是持久的。
# 注意：hammerspoon 的 .node-version 要求 Node v24，其余 v22。

# 5. 删除 Raycast 里指向旧 ForkedExtensions 路径的 dev 扩展，避免重复条目
```

## 日常双端工作流

1. **开工前**：`git pull`（在 extensions-mods 内）
2. **收工前**：`git commit` + `git push`
3. 两台机器都会改代码 → 严格执行"先 pull 后改"，避免同文件并发编辑
4. apple-photos 变体的改动在对应 worktree 分支上提交，同样 push

## 更新上游（raycast/extensions）

```bash
git fetch upstream
git merge upstream/main   # 在 my-mods 上；冲突只出现在改过的扩展目录
npm install               # 每个受影响的扩展目录
git push
```

## 提交规范

gitmoji 风格：`:sparkles: 新功能`、`:bug: 修 bug`、`:wrench: 杂项配置`、`:memo: 文档`、`:busts_in_silhouette: 贡献者`、`:fire: 删除`。
