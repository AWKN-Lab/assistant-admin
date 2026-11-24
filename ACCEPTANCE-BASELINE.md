# 验收基线标牌（ACCEPTANCE BASELINE）

> 本文件解决一个具体的坑：**仓库 HEAD 会继续往前走，但"被验收的是哪一版"必须一眼可见**。
> 平台自动预检**只读仓库默认分支** ⇒ 若默认分支上放的不是被验收的那一版，
> 预检就会判「在读到的内容里没有找到对应内容」（`acceptance=not_matched`）。

## 本次验收对应的 commit

| 订单 | 验收基线 commit |
|---|---|
| #1888 | `b55977b21a6378c5530bc6c80e9cb9e05ae02bc4` |

本仓当前 HEAD 相对验收基线的改动属**交付后的加固**（CI 纳入中文字形自检、门禁与清单重算），**未改动验收所依据的实现与证据**。

## 复跑（以基线为准）

```bash
# 取基线那一版（不改动工作区）
git fetch origin && git worktree add /tmp/baseline b55977b21a63
# 或直接看已归档的目录（membership-dashboard 有）
```

## 提交时的状态（供复核）

- 平台侧：`status=submitted`、`latest_delivery_version=1`、托管已 `funded`。
- 自动预检**不是评审、不决定验收与付款**；验收结论以人工复核 + 本文件指向的基线为准。
