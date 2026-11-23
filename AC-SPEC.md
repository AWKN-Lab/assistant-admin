# S5-ASST-022 / #1888 · 原始验收分母锁定

工单：`S5-ASST-022`，工作台路由 `/workbench/admin/assistant`。本演示仅使用虚构 Mock 数据，不包含真实客户信息或凭据。

| ID | 原始条款 | 实现位置 | 当前可信状态 |
|---|---|---|---|
| AC1 | 非系统管理员访问该路由时跳转无权限页（测试） | `src/App.tsx` 路由门、`tests/admin.test.tsx` + `tests/policy.test.ts` | 纯策略 PASS；组件未运行 |
| AC2 | 关闭全局开关时未填原因无法提交（组件测试） | `src/App.tsx` 原因弹窗及二次确认，`src/policy.ts` | 纯策略 PASS；组件未运行 |
| AC3 | 强制关闭状态下顶部红色横幅可见（截图） | `src/App.tsx` `force-off-banner`，`src/styles.css` | 截图未执行 |
| AC4 | 超时输入 500 或 40000 时表单校验失败（组件测试） | `src/App.tsx` `timeout-input`，`src/policy.ts` | 纯策略 PASS；组件未运行 |

附加范围：工具注册表10个字段、工具启停、角色多选、超时、变更原因、全局关闭二次确认、站点/角色/工具新增删除、有效状态、最近20条审计。正常/全局关闭/环境变量强制关闭/加载失败四张截图。S2-WB和S2-IAM使用模拟接口；正式服务端权限与ASST_FORCE_OFF需后续集成。

**记录原则**：代码存在、测试编写、测试实际通过、真实截图、平台交付、客户验收是不同阶段。未执行的门禁保持 UNKNOWN，不写成 PASS。
