import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../src/App';
const path='/workbench/admin/assistant';
beforeEach(()=>{window.history.replaceState(null,'',path+'?demo=normal&role=system_admin');});
afterEach(()=>cleanup());
describe('S5-ASST-022 original acceptance criteria',()=>{
  it('AC1 redirects unauthorized non-admin to 403',()=>{
    window.history.replaceState(null,'',path+'?role=operator');
    render(<App/>);
    expect(screen.getByTestId('forbidden')).toBeTruthy();
    expect(window.location.pathname).toBe('/403');
  });
  it('AC1 denies access when role parameter is absent',()=>{
    window.history.replaceState(null,'',path+'?demo=normal');
    render(<App/>);
    expect(screen.getByTestId('forbidden')).toBeTruthy();
    expect(window.location.pathname).toBe('/403');
  });
  it('AC2 prevents global shutdown without reason',async()=>{
    render(<App/>);
    await screen.findByTestId('tool-row-t1');
    fireEvent.click(screen.getByText('关停开关'));
    const control=await screen.findByTestId('global-switch');
    fireEvent.click(control);
    const dialog=await screen.findByTestId('reason-dialog');
    expect(dialog).toBeTruthy();
    fireEvent.click(screen.getByText('保存修改'));
    expect(await screen.findByText(/请填写修改原因/)).toBeTruthy();
    expect(screen.queryByTestId('double-confirm')).toBeNull();
    expect(screen.getByTestId('effective-state').textContent).toContain('正常运行');
  });
  it('AC3 shows forced off banner and disables global switch', async()=>{
    window.history.replaceState(null,'',path+'?demo=forceOff&role=system_admin');
    render(<App/>);
    expect(await screen.findByTestId('force-off-banner')).toBeTruthy();
    expect(screen.getByTestId('force-off-banner').textContent).toContain('已被环境变量强制关闭，页面开关暂不生效');
    fireEvent.click(screen.getByText('关停开关'));
    expect(screen.getByTestId('global-switch').getAttribute('class')).toMatch(/disabled/);
  });
  it('AC4 timeout 500 and 40000 show validation error',async()=>{
    render(<App/>);
    const row=await screen.findByTestId('tool-row-t1');
    fireEvent.click(within(row).getByText('超时'));
    // TDesign Input 把 data-testid 落在外层 div 上（1.18.6 无 inputProps 直通原生 input），
    // 必须取其内部原生 input 才能触发 change；断言本身未改。
    const wrapper=await screen.findByTestId('timeout-input');
    const input=wrapper.querySelector('input') as HTMLInputElement;
    expect(input).toBeTruthy();
    for(const value of ['500','40000']){
      fireEvent.change(input,{target:{value}});
      await waitFor(()=>expect(screen.getByText('超时必须为1000–30000毫秒的整数')).toBeTruthy());
    }
  });
  it('failed load renders error and retry',async()=>{
    window.history.replaceState(null,'',path+'?demo=loadError&role=system_admin');
    render(<App/>);
    expect(await screen.findByTestId('load-error')).toBeTruthy();
    expect(screen.getByText('重新加载')).toBeTruthy();
  });
  it('renders tool table with six registered tools',async()=>{
    render(<App/>);
    expect(await screen.findByTestId('tool-row-t1')).toBeTruthy();
    expect(screen.getByTestId('tool-row-t6')).toBeTruthy();
    expect(screen.getAllByText('角色').length).toBeGreaterThan(0);
  });
});
