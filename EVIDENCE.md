# EVIDENCE

工单 ClawHunt #1888 / S5-ASST-022。本文件记录门禁数字、命令退出码与日志位置。

## 1. 类名门禁数字自洽说明

同一脚本 `scripts/check-classes.mjs`，同一套提取逻辑：扫描 `src/*.tsx` 的 `className`（模板字符串先剔除 `${...}`），再解析 `src/styles.css` 每个规则块的类选择器，求差集。

| 时点 | CSS 来源 | CSS sha256 | 输出 | 退出码 |
|---|---|---|---|---|
| 修前 | 共享候选原 `styles.css` | `c17a3455577d667a86a3314cef9b76dfcf5685fe4d86758710a6134bd5540e5d` | `USED=92 DEFINED=83 UNDEFINED=74` | 1 |
| 修后 | 重写后的 `styles.css` | `48794c72bc8060a8e9cc4a086eb7f634428017db4eef3cf0de2c7abccd472335` | `USED=92 DEFINED=99 UNDEFINED=0` | 0 |

修前不是「只加 16 条定义」：整张样式表按 App 的类名重写。

| 统计 | 值 |
|---|---|
| 旧规则块 / 新规则块 | 134 / 163 |
| 旧类名 / 新类名 | 83 / 99 |
| 新增类名 | 78 |
| 删除旧类名 | 62 |
| 两边都保留 | 21 |
| 净变化 | +16（78 新增 − 62 删除） |
| 新类名中有实际声明 | 99 |
| 仅选择器、无声明空壳 | 0 |

即：74 个原缺失类名全部随重写新增；同时删掉 62 个旧命名类名，净差 +16。完整增删清单见 `evidence/css-diff.txt`。

抽查 5 个原缺失类名（新 `src/styles.css` 行号，见 `evidence/css-sample-lines.txt`）：

| 类名 | 行号 | 原文 |
|---|---|---|
| `.layout` | 25 | `.layout {` |
| `.force-banner` | 401 | `.force-banner {` |
| `.status-pill` | 512 | `.status-pill {` |
| `.tools-table` | 699 | `.tools-table {` |
| `.scope-table` | 907 | `.scope-table {` |

## 2. 命令与退出码（2026-11-23 实测）

| 命令 | 实测输出 | 退出码 |
|---|---|---|
| `npm ci` | added 197 packages | 0 |
| `npm test` | Test Files 2 passed；Tests 21 passed | 0 |
| `npm run test:policy` | pass 31 / fail 0 | 0 |
| `npm run build` | `tsc -b && vite build` 成功 | 0 |
| `npm run screenshot` | PASS 4 real Chromium screenshots；外部请求 0；页面错误 0 | 0 |
| `npm run check:classes` | `USED=92 DEFINED=99 UNDEFINED=0` | 0 |
| `npm run check:secrets` | `FILES_SCANNED=58 SECRET_HITS=0 NON_ASCII_NAMES=0` | 0 |
| `npm run check:glyphs` | `GLYPH_CHECK=PASS` | 0 |
| 真环境负控（WSL Ubuntu，无中文字体） | `ZH_FONT_COUNT=0`；`CJK_GLYPH_MISSING=9`；`GLYPH_CHECK=FAIL` | 1（负控预期） |
| `npm run check:glyphs:negative`（辅助） | 9 个目标全部 `renders as notdef` | 1（负控预期） |
| `npm run manifest` | 生成 `MANIFEST.sha256` | 0 |
| `npm run verify:manifest` | 干净副本校验通过 | 0 |

## 3. 日志与证据文件

| 文件 | 内容 |
|---|---|
| `evidence/verification.log` | ci / test / policy / build 完整输出与 SUMMARY |
| `evidence/vitest.log` | 组件测试 21 passed |
| `evidence/policy.log` | 31 pass / 0 fail |
| `evidence/build.log` | 构建输出 |
| `evidence/capture.log` | 截图运行输出 |
| `evidence/class-diff-before.log` | 修前复现（含脚本与 CSS sha256） |
| `evidence/class-diff-after.log` | 修后 0 未定义 |
| `evidence/class-gate.log` | 最终类名门禁 |
| `evidence/css-diff.txt` | 类名新增/删除/保留清单与规则数 |
| `evidence/css-sample-lines.txt` | 5 个类名的 CSS 行号 |
| `evidence/secrets.log` | 密钥扫描 0 命中、文件名全 ASCII |
| `evidence/glyphs.log` | 汉字字形自检 PASS |
| `evidence/glyphs-negative-real.log` | 真实缺 CJK 字体环境负控：环境构造、原始输出、还原步骤（exit 1） |
| `evidence/glyphs-negative.log` | `--simulate-notdef` 辅助负控 exit 1 |
| `evidence/cleanroom.log` | 干净副本测试、构建、清单计算与二次校验 |
| `docs/screenshot-receipt.json` | 截图元数据（viewport、字节、外部请求、页面错误） |
| `MANIFEST.sha256` | 仓内全部交付文件清单（路径 + sha256） |

## 4. 平台读取

仓根直接提供 `README.md`、`ACCEPTANCE.md`、`ACCEPTANCE-EVIDENCE.md`、`EVIDENCE.md`、`MANIFEST.sha256`；AC 证据不依赖 `docs/` 子目录。
