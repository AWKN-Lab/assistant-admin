> 📌 **验收基线见 [`ACCEPTANCE-BASELINE.md`](ACCEPTANCE-BASELINE.md)** —— 本仓 HEAD 会继续往前走，但"被验收的是哪一版"在那里一眼可见。

# S5-ASST-022 · 会员空间平台助手管理页

ClawHunt 订单 **#1888**，工作台管理路由 **`/workbench/admin/assistant`**。本代码仓是单订单独立交付，不包含其他工单业务代码。数据、角色、站点名称全部虚构；未使用实际客户身份、密钥、企业资料。**不含境外数据上报 SDK**。

## 运行

Node.js 20+（推荐22）、npm：

```bash
npm ci                # 按 package-lock.json 安装
npm run dev           # http://127.0.0.1:28088/workbench/admin/assistant?role=system_admin
npm run test:policy   # 31 项共享业务逻辑断言，不需要浏览器
npm test              # 组件测试 20 项（Vitest + jsdom）
npm run build         # TypeScript 检查及 Vite 本地构建
npm run check:no-external
npm run check:classes # 组件类名与样式表差集，要求 UNDEFINED=0
npm run check:secrets # 密钥/内网 IP/内部路径扫描 + 文件名 ASCII
npm run check:glyphs  # 9 个汉字渲染自检；负控 npm run check:glyphs:negative 必须退出 1
npm run manifest && npm run verify:manifest
npm run screenshot    # 需要本地 Chrome/Chromium，或指定 CHROME_PATH；1440x960 首屏
```

工程使用 **React 18 + TypeScript + Vite + TDesign React**。全部组件依赖通过 npm 锁文件管理。运行期 JS/CSS/字体仅加载本地产物。请勿使用 CDN 替代已锁定的组件包。

## 交付内容

- `src/App.tsx`：工具配置、角色选择、超时、原因弹窗及二次确认、分级关停、最近20项审计、四种状态。
- `src/policy.ts`：独立于 UI 的权限、范围有效性、理由与超时校验，配置操作和审计纯函数。
- `src/mockSeed.ts`：虚构工具、角色、站点、变更记录；`src/mock.ts`：异步接口桩。
- `tests/policy.test.ts`：Node 测试；`tests/admin.test.tsx`：组件测试。
- `docs/screenshots/`：4个状态实际浏览器截图；`docs/screenshot-receipt.json`：截图和网络检查结果。

## 四种状态与截图 URL

| 状态 | 路径查询 | 截图文件 |
|---|---|---|
| 正常 | `?role=system_admin&demo=normal` | `normal.png` |
| 全局关闭 | `?role=system_admin&demo=globalOff` | `globalOff.png` |
| 强制关闭 | `?role=system_admin&demo=forceOff` | `forceOff.png` |
| 加载失败 | `?role=system_admin&demo=loadError` | `loadError.png` |

截图统一为 1440x960 视口、非全页截图，首屏可见管理页主体。`demo` 参数及 `?role=operator` **只用于 Mock 演示和前端测试**；不传 `role` 或角色不是管理员时一律进入 `/403`（默认拒绝，显式放行）。上线后移除 Mock 参数并接入真实身份、配置、审计 API。

## AC 逐条验收

| AC | 实现 | 测试 |
|---|---|---|
| 1. 非系统管理员路由跳转无权限页 | `isAdmin`、`/403`；不传角色默认拒绝 | `tests/admin.test.tsx` 无参与重定向 2 条；`tests/admin-extra.test.tsx` operator / viewer / admin 3 条；`tests/policy.test.ts` |
| 2. 关闭全局开关未填原因无法提交 | `reason-dialog` 必填原因 + 关闭前 `double-confirm` | `tests/admin.test.tsx`「AC2 prevents global shutdown without reason」；`tests/admin-extra.test.tsx` 二次确认用例 |
| 3. 强制关闭状态顶部红色横幅可见 | `force-off-banner`，优先级最高 | `tests/admin.test.tsx`「AC3 shows forced off banner and disables global switch」；`docs/screenshots/forceOff.png` |
| 4. 输入超时 500 或 40000 表单校验失败 | 1000–30000 整数边界 | `tests/admin.test.tsx`「AC4 timeout 500 and 40000 show validation error」；`tests/admin-extra.test.tsx` 500 拒绝与边界用例 |

断言原文、命令与预期输出见 `ACCEPTANCE.md`；AC ↔ 证据总表见 `ACCEPTANCE-EVIDENCE.md`；门禁数字与日志索引见 `EVIDENCE.md`。三个文件均在仓根。

## 功能完整性

工具注册列表含：显示名称、name、提供模块、版本、副作用类型、是否需确认、超时、启用状态、可见角色、近7天调用次数及失败率。工具开关、角色多选和超时修改统一要求原因；开启、关闭全局功能均需要原因，全局**关闭**额外需要二次确认。站点、角色、工具支持新增和删除范围条目，并显示当前生效状态。审计保留最新20条：时间、角色、范围、原因及操作详情。

**有效策略优先级**：`ASST_FORCE_OFF` > 全局关闭 > 工具本身关闭 > 当前角色不可见 > 站点/角色/工具三级关停 > 正常。角色范围是交集限制。服务器对每一次写操作必须重复校验管理员权限，不能信任页面的按钮禁用状态。

## S2-WB / S2-IAM 集成点（待上游提供真实协议）

1. `GET /api/workbench/admin/assistant/state`：由后端（Python 3.11 / FastAPI）返回工具目录、策略、审计、以及 **`forceOff`**。后端在**运行时**读取 `ASST_FORCE_OFF` 环境变量并覆盖其余开关；浏览器不可直接读取服务端环境变量。当前 `VITE_ASST_FORCE_OFF` 是开发演示桩，生产不可依赖它提供强制关停保障。
2. `PATCH /api/workbench/admin/assistant/tools/{id}`：仅 IAM 认证的 `system_admin`，验证原因、超时、角色和变更版本；防止竞态、越权、审计丢失。
3. `PUT /api/workbench/admin/assistant/global`、`POST/DELETE .../overrides`：强制服务端记录操作者身份、时间、理由、策略版本；关停与审计在同一事务中提交；客户端交互二次确认不能代替服务端授权。
4. S2-WB 路由注册：`/workbench/admin/assistant`；S2-IAM 路由守卫：管理员允许，其余跳转 `/403`。本项目只提供浏览器示范和纯前端守卫，生产权限以后端为准。
5. 平台规定的业务表公用字段 `id(UUID), org_id, site_id, created_at, created_by, updated_at, deleted_at`、软删、审计流水由服务端实现；此 Mock 不对 PostgreSQL 写入。

## 来源与许可证

- [Tencent TDesign React](https://github.com/Tencent/tdesign-react)，MIT；本单直接通过 npm 依赖链接使用官方组件，未拷贝组件库源码。
- [Tencent TDesign React Starter](https://github.com/Tencent/tdesign-react-starter)，MIT；仅参考后台布局和工程结构，本单的 TSX/CSS/业务逻辑独立编写。
- [Flagsmith](https://github.com/Flagsmith/flagsmith)，BSD-3-Clause；仅借鉴开关优先级与审计理念，未拷贝源码。
- 不包含 Unleash AGPL 代码。

## 交付边界

本单尚未接入真实后端，不声称生产部署、云环境强制关停或独立审核；截图是基于虚构 Mock 状态的浏览器渲染。不能从单页面代码推断服务器数据权限已经实现。提交平台前需核对实际测试、截图文件、GitHub/PR可访问性与平台交付回执。
