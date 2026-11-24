# ACCEPTANCE-EVIDENCE

工单 ClawHunt #1888 / S5-ASST-022。平台只读仓根文件，本文件把每条 AC 的证据钉在仓根。

| AC | 平台条款（原文） | 交付物 | 测试 / 证据 | 可复跑命令 | 预期输出 |
|---|---|---|---|---|---|
| AC1 | Go to the unauthorized page when a non-system administrator accesses this route (test) | `src/App.tsx`、`src/policy.ts` | `tests/admin.test.tsx` 2 条 + `tests/admin-extra.test.tsx` 3 条；无参数 / operator / viewer 均断言 `/403` | `npm test -- -t "AC1"` | 5 passed；`forbidden` 可见、`admin-page` 为 null、`pathname==='/403'` |
| AC2 | Unable to submit due to unfilled reasons when the global switch is turned off (component test) | `src/App.tsx`、`src/policy.ts` | `tests/admin.test.tsx`「AC2 prevents global shutdown without reason」；断言「请填写修改原因」、`double-confirm` 为 null、状态仍「正常运行」 | `npm test -- -t "AC2"` | 1 passed |
| AC3 | The red banner at the top is visible when it is forcibly closed (screenshot) | `docs/screenshots/forceOff.png`（117,946 B，sha256 `c2180880fbc2314bd38ad7d856bd3dff53b60e92c7c1280cae4eb36ea8363c8b`） | 组件测试断言横幅原文；截图 1440x960 首屏、非全页 | `npm test -- -t "AC3"`；`npm run screenshot` | 1 passed；红横幅原文「已被环境变量强制关闭，页面开关暂不生效」可见 |
| AC4 | Form validation fails when entering 500 or 40000 over a timeout (component test) | `src/App.tsx`、`src/policy.ts` | `tests/admin.test.tsx`「AC4 timeout 500 and 40000 show validation error」；对 500 与 40000 循环断言错误文案 | `npm test -- -t "AC4"` | 1 passed；文案「超时必须为1000–30000毫秒的整数」 |

## 截图（1440x960，fullPage=false）

| 状态 | 文件 | 字节 | sha256 |
|---|---|---|---|
| 正常 | `docs/screenshots/normal.png` | 120,808 | `9e49d5b90d4584a30e2aa1cae0d61cc72907cb2fcf2cd1c2ec5745141a54d3f5` |
| 全局关闭 | `docs/screenshots/globalOff.png` | 121,000 | `d7dfc05ae9632722142e6c701d875ff2d15b3a28c036052dddcfbe600e8c2e75` |
| 强制关闭 | `docs/screenshots/forceOff.png` | 117,946 | `c2180880fbc2314bd38ad7d856bd3dff53b60e92c7c1280cae4eb36ea8363c8b` |
| 加载失败 | `docs/screenshots/loadError.png` | 46,924 | `4c87eb38248662ac916337c7c0edd4a0c0bcc183f32ee264bddb2bf50936ea38` |

页面错误 0、外部请求 0；回执 `docs/screenshot-receipt.json`。

## 门禁

| 门禁 | 命令 | 实测 |
|---|---|---|
| 类名差集 | `npm run check:classes` | 修前 `USED=92 DEFINED=83 UNDEFINED=74`（exit 1）；修后 `USED=92 DEFINED=99 UNDEFINED=0`（exit 0） |
| 密钥扫描 | `npm run check:secrets` | `FILES_SCANNED=58 SECRET_HITS=0 NON_ASCII_NAMES=0` |
| 字形自检 | `npm run check:glyphs` | `GLYPH_CHECK=PASS`，9 个汉字均不等于 notdef 参照 |
| 字形负控（真环境） | WSL2 Ubuntu 24.04 无中文字体：`node scripts/check-glyphs.mjs` | 必须 exit 1：`fc-list :lang=zh`=0 下 `CJK_GLYPH_MISSING=9`、`GLYPH_CHECK=FAIL`；日志含环境构造与还原 |
| 字形负控（辅助） | `npm run check:glyphs:negative` | 必须 exit 1：9 个目标被替换为 U+E000–E008 后全部命中 notdef |
| 清单 | `npm run manifest` / `npm run verify:manifest` | 干净副本计算并在第二份干净副本校验通过 |

日志：`evidence/class-diff-before.log`、`class-diff-after.log`、`class-gate.log`、`secrets.log`、`glyphs.log`、`glyphs-negative-real.log`、`glyphs-negative.log`、`verification.log`。

## 机器可读证据（DOM 文本转储）

平台预检**读不了 PNG** ⇒ 这里给出「截图里能看见的东西」的**可复制文本**：
`evidence/dom.log`（生成脚本 `scripts/dump-dom.mjs`，`node scripts/dump-dom.mjs` 可复跑）。

| 状态 | URL 参数 | 最终 pathname | 页面错误 | 外部请求 |
|---|---|---|---|---|
| normal | `role=system_admin&demo=normal` | `/workbench/admin/assistant?role=system_admin&demo=normal` | 0 | 0 |
| globalOff | `role=system_admin&demo=globalOff` | `/workbench/admin/assistant?role=system_admin&demo=globalOff` | 0 | 0 |
| forceOff | `role=system_admin&demo=forceOff` | `/workbench/admin/assistant?role=system_admin&demo=forceOff` | 0 | 0 |
| loadError | `role=system_admin&demo=loadError` | `/workbench/admin/assistant?role=system_admin&demo=loadError` | 0 | 0 |
| forbidden-operator | `role=operator&demo=normal` | `/403?role=operator&demo=normal` | 0 | 0 |
| forbidden-no-role | `demo=normal` | `/403?demo=normal` | 0 | 0 |

**强制关闭横幅（AC3）的 DOM 实际渲染文本**：
```
已被环境变量强制关闭，页面开关暂不生效
```

**无权限页（AC1）的 DOM 实际渲染文本**：
```
403
```

完整逐行转储（含正常态工具注册表 6 行、全局关闭态、加载失败态）见 `evidence/dom.log`。
