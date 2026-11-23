import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../src/App';

// P1 补充行为测试（计划 §2 P1）：原 6 条用例不动，新增文件覆盖描述性需求。
// 角色多选持久化、审计截断、权限拒绝、重复操作等纯函数部分已由 31 项政策测试覆盖，
// 这里只补组件层可真实交互的部分；TDesign 弹窗类 Select 不做脆弱的下拉交互断言。
const path = '/workbench/admin/assistant';
beforeEach(() => { window.history.replaceState(null, '', path + '?demo=normal&role=system_admin'); });
afterEach(() => cleanup());

function innerInput(testId: string): HTMLInputElement {
  const wrapper = screen.getByTestId(testId);
  const input = wrapper.querySelector('input') as HTMLInputElement;
  expect(input).toBeTruthy();
  return input;
}
function auditDataRows(): number {
  return within(screen.getByTestId('audit-list')).getAllByRole('row').length - 1;
}
function setReason(text: string) {
  fireEvent.change(innerInput('reason-input'), { target: { value: text } });
}
async function openToolTimeout(toolId: string) {
  const row = await screen.findByTestId(`tool-row-${toolId}`);
  fireEvent.click(within(row).getByText('超时'));
  await screen.findByTestId('reason-dialog');
}
async function switchToSwitchesTab() {
  fireEvent.click(screen.getByText('关停开关'));
  await screen.findByTestId('switches-tab');
}
function overrideRuleCount(): number {
  const m = within(screen.getByTestId('switches-tab')).getByText(/条生效规则/).textContent?.match(/(\d+)/);
  return m ? Number(m[1]) : -1;
}

describe('S5-ASST-022 supplementary behaviour', () => {
  it('AC1 admin sees the admin page', async () => {
    render(<App />);
    expect(await screen.findByTestId('admin-page')).toBeTruthy();
    expect(screen.queryByTestId('forbidden')).toBeNull();
  });

  it('AC1 operator sees no admin content and is routed to /403', () => {
    window.history.replaceState(null, '', path + '?role=operator');
    render(<App />);
    expect(screen.getByTestId('forbidden')).toBeTruthy();
    expect(screen.queryByTestId('admin-page')).toBeNull();
    expect(window.location.pathname).toBe('/403');
  });

  it('AC1 viewer sees no admin content and is routed to /403', () => {
    window.history.replaceState(null, '', path + '?role=viewer');
    render(<App />);
    expect(screen.getByTestId('forbidden')).toBeTruthy();
    expect(screen.queryByTestId('admin-page')).toBeNull();
    expect(window.location.pathname).toBe('/403');
  });

  it('tool timeout edit requires a reason and writes nothing', async () => {
    render(<App />);
    await openToolTimeout('t1');
    expect(auditDataRows()).toBe(8);
    fireEvent.click(screen.getByText('保存修改'));
    expect(await screen.findByText(/请填写修改原因/)).toBeTruthy();
    expect(auditDataRows()).toBe(8);
  });

  it('tool timeout valid save persists and audits', async () => {
    render(<App />);
    await openToolTimeout('t1');
    fireEvent.change(innerInput('timeout-input'), { target: { value: '15000' } });
    setReason('排障调整');
    fireEvent.click(screen.getByText('保存修改'));
    await waitFor(() => expect(screen.queryByTestId('reason-dialog')).toBeNull());
    expect(within(screen.getByTestId('audit-list')).getByText(/超时调整为 15000ms/)).toBeTruthy();
    const row = screen.getByTestId('tool-row-t1');
    expect(row.textContent).toContain('15,000');
    expect(auditDataRows()).toBe(9);
  });

  it('timeout boundaries 1000 and 30000 both pass and persist', async () => {
    render(<App />);
    await openToolTimeout('t1');
    fireEvent.change(innerInput('timeout-input'), { target: { value: '1000' } });
    setReason('边界下限');
    fireEvent.click(screen.getByText('保存修改'));
    await waitFor(() => expect(within(screen.getByTestId('audit-list')).getByText(/超时调整为 1000ms/)).toBeTruthy());
    await openToolTimeout('t1');
    fireEvent.change(innerInput('timeout-input'), { target: { value: '30000' } });
    setReason('边界上限');
    fireEvent.click(screen.getByText('保存修改'));
    await waitFor(() => expect(within(screen.getByTestId('audit-list')).getByText(/超时调整为 30000ms/)).toBeTruthy());
    expect(screen.getByTestId('tool-row-t1').textContent).toContain('30,000');
  });

  it('invalid timeout 500 is rejected and writes nothing', async () => {
    render(<App />);
    await openToolTimeout('t1');
    fireEvent.change(innerInput('timeout-input'), { target: { value: '500' } });
    setReason('越界尝试');
    fireEvent.click(screen.getByText('保存修改'));
    // 字段提示与弹窗报错同时显示同一文案，用 findAllByText 断言至少出现一次。
    expect((await screen.findAllByText('超时必须为1000–30000毫秒的整数')).length).toBeGreaterThan(0);
    expect(auditDataRows()).toBe(8);
    fireEvent.click(screen.getByText('取消'));
    await waitFor(() => expect(screen.queryByTestId('reason-dialog')).toBeNull());
    expect(screen.getByTestId('tool-row-t1').textContent).toContain('8,000');
  });

  it('global close with reason shows double-confirm; nothing changes until confirmed', async () => {
    render(<App />);
    await screen.findByTestId('tool-row-t1');
    await switchToSwitchesTab();
    fireEvent.click(screen.getByTestId('global-switch'));
    await screen.findByTestId('reason-dialog');
    setReason('计划维护');
    fireEvent.click(screen.getByText('保存修改'));
    expect(await screen.findByTestId('double-confirm')).toBeTruthy();
    expect(screen.getByTestId('effective-state').textContent).toContain('正常运行');
    expect(auditDataRows()).toBe(8);
    fireEvent.click(screen.getByText('确认关闭'));
    await waitFor(() => expect(screen.getByTestId('effective-state').textContent).toContain('全局关闭'));
    expect(auditDataRows()).toBe(9);
    expect(within(screen.getByTestId('audit-list')).getByText(/关闭全局助手/)).toBeTruthy();
  });

  it('force-off disables entries and takes precedence over page switches', async () => {
    window.history.replaceState(null, '', path + '?demo=forceOff&role=system_admin');
    render(<App />);
    expect(await screen.findByTestId('force-off-banner')).toBeTruthy();
    // 先在默认工具页签中断言工具入口禁用（切页签后非活动面板会卸载）。
    const row = await screen.findByTestId('tool-row-t1');
    expect(screen.getByTestId('toggle-t1').getAttribute('class')).toMatch(/disabled/);
    fireEvent.click(within(row).getByText('角色'));
    expect(screen.queryByTestId('reason-dialog')).toBeNull();
    fireEvent.click(screen.getByText('关停开关'));
    expect(screen.getByTestId('global-switch').getAttribute('class')).toMatch(/disabled/);
    expect(screen.getByTestId('effective-state').textContent).toContain('强制关闭');
  });

  it('roles dialog shows current visible roles', async () => {
    render(<App />);
    const row = await screen.findByTestId('tool-row-t1');
    fireEvent.click(within(row).getByText('角色'));
    await screen.findByTestId('reason-dialog');
    const select = screen.getByTestId('roles-select');
    expect(select.textContent).toContain('系统管理员');
    expect(select.textContent).toContain('运营经理');
  });

  it('override add requires reason, persists, and duplicate is rejected', async () => {
    render(<App />);
    await screen.findByTestId('tool-row-t1');
    await switchToSwitchesTab();
    expect(overrideRuleCount()).toBe(3);
    fireEvent.click(screen.getByText(/新增条目/));
    await screen.findByTestId('reason-dialog');
    fireEvent.click(screen.getByText('保存修改'));
    expect(await screen.findByText(/请填写修改原因/)).toBeTruthy();
    expect(overrideRuleCount()).toBe(3);
    setReason('测试切流');
    fireEvent.click(screen.getByText('保存修改'));
    await waitFor(() => expect(overrideRuleCount()).toBe(4));
    fireEvent.click(screen.getByText(/新增条目/));
    await screen.findByTestId('reason-dialog');
    setReason('重复添加');
    fireEvent.click(screen.getByText('保存修改'));
    expect(await screen.findByText(/该范围条目已经存在/)).toBeTruthy();
    expect(overrideRuleCount()).toBe(4);
  });

  it('override delete removes the entry', async () => {
    render(<App />);
    await screen.findByTestId('tool-row-t1');
    await switchToSwitchesTab();
    expect(overrideRuleCount()).toBe(3);
    const deletes = within(screen.getByTestId('switches-tab')).getAllByText('删除');
    fireEvent.click(deletes[0]);
    await screen.findByTestId('reason-dialog');
    setReason('恢复站点');
    fireEvent.click(screen.getByText('保存修改'));
    await waitFor(() => expect(overrideRuleCount()).toBe(2));
  });

  it('audit list shows at most 20 rows', async () => {
    render(<App />);
    await screen.findByTestId('audit-list');
    expect(auditDataRows()).toBeLessThanOrEqual(20);
    expect(auditDataRows()).toBe(8);
    expect(within(screen.getByTestId('audit-list')).getByText(/最新 8 条/)).toBeTruthy();
  });

  it('load error retry re-attempts and stays in error state', async () => {
    window.history.replaceState(null, '', path + '?demo=loadError&role=system_admin');
    render(<App />);
    expect(await screen.findByTestId('load-error')).toBeTruthy();
    fireEvent.click(screen.getByText('重新加载'));
    expect(await screen.findByTestId('load-error')).toBeTruthy();
  });
});
