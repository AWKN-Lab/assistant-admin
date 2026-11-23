# ACCEPTANCE

工单：ClawHunt #1888 / S5-ASST-022。路由：`/workbench/admin/assistant`。
本文件逐条列出 AC、测试名、断言原文、复跑命令与预期输出。

## AC1 非系统管理员访问 ⇒ 无权限页

| 项 | 内容 |
|---|---|
| 实现 | `src/App.tsx`：`role` 缺省为空串，`isAdmin` 仅接受管理员角色；非管理员 `history.replaceState` 到 `/403` 并渲染 `data-testid="forbidden"` |
| 测试 | `tests/admin.test.tsx`「AC1 denies access when role parameter is absent」「AC1 redirects unauthorized non-admin to 403」；`tests/admin-extra.test.tsx`「AC1 operator sees no admin content and is routed to /403」「AC1 viewer sees no admin content and is routed to /403」「AC1 admin sees the admin page」 |
| 断言原文 | `expect(screen.getByTestId('forbidden')).toBeTruthy();`<br>`expect(screen.queryByTestId('admin-page')).toBeNull();`<br>`expect(window.location.pathname).toBe('/403');` |
| 命令 | `npm test -- -t "AC1"` |
| 预期 | 5 passed：无参数、operator、viewer 均 403；system_admin 进入管理页 |

## AC2 全局开关关闭且原因为空 ⇒ 无法提交

| 项 | 内容 |
|---|---|
| 实现 | `src/App.tsx` 全局开关点击后打开 `reason-dialog`；`src/policy.ts` `validReason` 拒绝空白原因；原因为空时不进入 `double-confirm`，生效状态保持「正常运行」 |
| 测试 | `tests/admin.test.tsx`「AC2 prevents global shutdown without reason」；`tests/admin-extra.test.tsx`「global close with reason shows double-confirm; nothing changes until confirmed」 |
| 断言原文 | `fireEvent.click(screen.getByText('保存修改'));`<br>`expect(await screen.findByText(/请填写修改原因/)).toBeTruthy();`<br>`expect(screen.queryByTestId('double-confirm')).toBeNull();`<br>`expect(screen.getByTestId('effective-state').textContent).toContain('正常运行');` |
| 命令 | `npm test -- -t "AC2"` |
| 预期 | 1 passed：空白原因被拦截，未出现二次确认，状态未变更 |

## AC3 强制关闭 ⇒ 顶部红色横幅可见

| 项 | 内容 |
|---|---|
| 实现 | `src/App.tsx` `data-testid="force-off-banner"`；`src/styles.css` `.force-banner` 红底红边 |
| 测试 | `tests/admin.test.tsx`「AC3 shows forced off banner and disables global switch」；截图 `docs/screenshots/forceOff.png` |
| 断言原文 | `expect(await screen.findByTestId('force-off-banner')).toBeTruthy();`<br>`expect(screen.getByTestId('force-off-banner').textContent).toContain('已被环境变量强制关闭，页面开关暂不生效');` |
| 命令 | `npm test -- -t "AC3"`；`npm run screenshot` |
| 预期 | 1 passed；1440x960 首屏截图内红横幅完整可见 |

## AC4 超时 500 或 40000 ⇒ 校验失败

| 项 | 内容 |
|---|---|
| 实现 | `src/App.tsx` `data-testid="timeout-input"`；`src/policy.ts` `validTimeout` 限制 1000–30000 的整数 |
| 测试 | `tests/admin.test.tsx`「AC4 timeout 500 and 40000 show validation error」；`tests/admin-extra.test.tsx`「invalid timeout 500 is rejected and writes nothing」「timeout boundaries 1000 and 30000 both pass and persist」 |
| 断言原文 | `for(const value of ['500','40000']){`<br>`  fireEvent.change(input,{target:{value}});`<br>`  await waitFor(()=>expect(screen.getByText('超时必须为1000–30000毫秒的整数')).toBeTruthy());`<br>`}` |
| 命令 | `npm test -- -t "AC4"` |
| 预期 | 1 passed：500 与 40000 均显示校验错误，不写入 |

## 全量验证

```bash
npm ci
npm test                  # 21 passed
npm run test:policy       # 31 passed
npm run build             # exit 0
npm run check:classes     # UNDEFINED=0
npm run check:secrets     # 0 hits, 0 non-ASCII names
npm run check:glyphs      # PASS；负控 --simulate-notdef 必须 exit 1
npm run screenshot        # 4 张 1440x960 首屏
npm run manifest && npm run verify:manifest
```
