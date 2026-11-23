import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Button, Dialog, Input, Select, Switch, Tag, Tabs, MessagePlugin } from 'tdesign-react';
import { applyMutation, effectiveState, failureRate, isAdmin, roleLabel, ROLES, validReason, validTimeout } from './policy';
import type { Mutation, Override, Role, Settings, Tool } from './policy';
import { getSeed, loadSettings, SITES } from './mock';

const exampleModes = [
  { label: '正常', value: 'normal' }, { label: '全局关闭', value: 'globalOff' },
  { label: '环境变量强制关闭', value: 'forceOff' }, { label: '加载失败', value: 'loadError' },
];
const scopeLabels: Record<string,string> = { site: '站点', role: '角色', tool: '工具' };
const impactLabels: Record<string,string> = { none: '无副作用', read: '只读', write: '数据写入', external: '外部动作' };

function Shell({ children }: { children: ReactNode }) {
  return <div className="layout">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">M<span>·</span></div><div><b>MEMBERSPACE</b><small>会员空间管理平台</small></div></div>
      <div className="sidebar-group-label">工作台</div>
      <nav className="main-nav">
        <div className="nav-entry"><span className="nav-icon">▦</span>运营总览</div>
        <div className="nav-entry"><span className="nav-icon">◇</span>会员企业</div>
        <div className="nav-entry"><span className="nav-icon">⇄</span>资源与商机</div>
        <div className="nav-entry"><span className="nav-icon">▤</span>知识库与 SOP</div>
      </nav>
      <div className="sidebar-group-label">系统管理</div>
      <nav className="main-nav">
        <div className="nav-entry"><span className="nav-icon">♧</span>角色与权限</div>
        <div className="nav-entry active"><span className="nav-icon">✳</span>AI 助手管理<span className="active-point" /></div>
        <div className="nav-entry"><span className="nav-icon">◷</span>操作审计</div>
      </nav>
      <div className="sidebar-bottom"><div className="system-status"><span className="alive-dot"/> 系统运行正常</div><div className="profile"><span className="avatar">管</span><div><strong>平台管理员</strong><small>系统管理员 · 演示身份</small></div><span className="more">⋯</span></div></div>
    </aside>
    <div className="workspace"><header className="topbar"><div className="breadcrumb">管理工作台 <span>/</span> 系统管理 <span>/</span> <b>AI 助手管理</b></div><div className="top-actions"><span className="top-icon">⌕</span><span className="top-icon">◌</span><span className="top-avatar">管</span></div></header>{children}</div>
  </div>;
}
function AccessDenied() {
  return <Shell><main className="content"><div className="forbidden" data-testid="forbidden"><div className="forbidden-number">403</div><h1>无权限访问</h1><p>只有系统管理员可以访问助手管理页面。请联系管理员分配权限。</p><a className="back-link" href="/workbench">返回工作台</a></div></main></Shell>;
}
function ErrorPanel({retry}: {retry:()=>void}) {
  return <div className="error-state" data-testid="load-error"><div className="error-symbol">!</div><h2>页面暂时无法加载</h2><p>助手配置接口发生错误，请稍后重新获取。</p><Button theme="primary" onClick={retry}>重新加载</Button></div>;
}
function SideEffectTag({kind}: {kind:Tool['sideEffect']}) {
  const color: 'danger' | 'warning' | 'primary' | 'default' = kind === 'external' ? 'danger' : kind === 'write' ? 'warning' : kind === 'read' ? 'primary' : 'default';
  return <Tag theme={color} variant="light">{impactLabels[kind]}</Tag>;
}
function Stats({data}: {data:Settings}) {
  const total = data.tools.length;
  const enabled = data.tools.filter(t => effectiveState(data,t,'site-01','operator').enabled).length;
  const calls = data.tools.reduce((a,t)=>a+t.calls7d,0);
  const risk = data.tools.filter(t=>t.confirmationRequired).length;
  return <div className="stats-grid">
    <section className="stat-card"><div><span>已注册工具</span><span className="stat-art">▦</span></div><strong>{total.toString().padStart(2,'0')}</strong><small>已接入平台工具注册表</small></section>
    <section className="stat-card"><div><span>当前可用工具</span><span className="stat-art teal">↗</span></div><strong>{enabled.toString().padStart(2,'0')} <em>/ {total}</em></strong><small>按当前站点与运营经理权限计算</small></section>
    <section className="stat-card"><div><span>近 7 天调用</span><span className="stat-art violet">▤</span></div><strong>{calls.toLocaleString('zh-CN')}</strong><small>汇总全部注册工具</small></section>
    <section className="stat-card"><div><span>高敏感工具</span><span className="stat-art peach">◇</span></div><strong>{risk.toString().padStart(2,'0')}</strong><small>执行时需要明确确认</small></section>
  </div>;
}
function LiveStatus({data, testId = 'effective-state'}: {data:Settings; testId?: string}) {
  const status = data.forceOff ? '强制关闭' : !data.globalEnabled ? '全局关闭' : '正常运行';
  const cls = data.forceOff ? 'danger' : !data.globalEnabled ? 'muted' : 'ok';
  return <span className={`status-pill ${cls}`} data-testid={testId}><span className="state-dot"/>{status}</span>;
}
function NoPermissionRoleTestHint() { return <span className="hint">身份验证由 S2-IAM 接口在服务端重新校验</span>; }

export function App() {
  const params = new URLSearchParams(window.location.search);
  const DEMO = params.get('demo') ?? 'normal';
  const AUTH_ROLE = params.get('role') ?? '';
  const [data, setData] = useState<Settings|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [busy,setBusy] = useState(true);
  const [tab,setTab] = useState('tools');
  const [filter,setFilter] = useState('');
  const [selectedAction,setSelectedAction] = useState<Mutation|null>(null);
  const [reason,setReason] = useState('');
  const [dialogStep,setDialogStep] = useState<'reason'|'double-confirm'>('reason');
  const [dialogError,setDialogError] = useState('');
  const [timeoutDraft,setTimeoutDraft] = useState('10000');
  const [rolesDraft,setRolesDraft] = useState<Role[]>(['system_admin']);
  const [overrideScope,setOverrideScope] = useState<Override['scope']>('site');
  const [overrideTarget,setOverrideTarget] = useState('site-01');
  const [overrideEnabled,setOverrideEnabled] = useState(false);
  const [banner,setBanner] = useState<string|null>(null);

  const forbidden = !isAdmin(AUTH_ROLE) || (window.location.pathname !== '/' && window.location.pathname !== '/workbench/admin/assistant');
  useEffect(() => {
    if (!isAdmin(AUTH_ROLE) && window.location.pathname !== '/403') window.history.replaceState(null, '', `/403${window.location.search}`);
  },[]);
  useEffect(() => {
    if (forbidden) return;
    let alive = true; setBusy(true); setError(null);
    loadSettings(DEMO).then(s => {if(alive){setData(s);setBusy(false);}}).catch((e:Error)=> {if(alive){setBusy(false);setError(e.message);}});
    return ()=>{alive=false;};
  },[forbidden]);
  function retry() { setBusy(true); setError(null); loadSettings(DEMO).then(setData).catch((e:Error)=>setError(e.message)).finally(()=>setBusy(false)); }
  function start(action:Mutation) { if (!data || data.forceOff) return; setSelectedAction(action);setReason('');setDialogStep('reason');setDialogError(''); }
  function cancel() {setSelectedAction(null);setDialogError('');setDialogStep('reason');}
  function commit() {
    if(!data||!selectedAction)return;
    if(!validReason(reason)){setDialogError('请填写修改原因（最多 200 字）');return;}
    if(selectedAction.kind==='global' && !selectedAction.enabled && dialogStep==='reason') {setDialogError('');setDialogStep('double-confirm');return;}
    try {
      const next=applyMutation(data,selectedAction,reason,AUTH_ROLE,new Date().toISOString());
      setData(next);setBanner('配置已保存，已记录操作原因');cancel();
      MessagePlugin.success('配置保存成功');
    }catch(e){setDialogError((e as Error).message);}
  }
  function openTimeout(t:Tool){setTimeoutDraft(String(t.timeoutMs));start({kind:'toolTimeout',toolId:t.id,timeoutMs:t.timeoutMs});}
  function openRoles(t:Tool){setRolesDraft([...t.visibleRoles]);start({kind:'toolRoles',toolId:t.id,roles:[...t.visibleRoles]});}
  function addOverride(){start({kind:'overrideAdd',scope:overrideScope,targetId:overrideTarget,enabled:overrideEnabled});}
  const visible=useMemo(()=>data?.tools.filter(t=>`${t.displayName}${t.name}${t.module}`.toLowerCase().includes(filter.toLowerCase()))??[],[data,filter]);
  const targetOptions = overrideScope==='site' ? SITES : overrideScope==='role' ? [...ROLES] : data?.tools.map(t=>({label:t.displayName,value:t.name}))??[];
  const editingTimeout=selectedAction?.kind==='toolTimeout';
  const editingRoles=selectedAction?.kind==='toolRoles';
  const timeoutValid=!editingTimeout||validTimeout(Number(timeoutDraft))&& /^\d+$/.test(timeoutDraft.trim());
  const rolesValid=!editingRoles || rolesDraft.length>0;

  if (forbidden) return <AccessDenied/>;
  return <Shell><main className="content" data-testid="admin-page">
    <div className="page-heading"><div><div className="page-kicker">AI OPERATIONS <span> / </span> 管理中心</div><h1>AI 助手管理</h1><p>统一配置助手工具、访问角色和安全关停策略，所有变更均记录审计日志。</p></div><div className="page-actions"><span className="mock-label">MOCK 演示</span><Select size="small" data-testid="demo-selector" value={DEMO} options={exampleModes} onChange={(v)=>{const next=new URLSearchParams(window.location.search);next.set('demo',String(v));next.set('role','system_admin');window.location.href=`/workbench/admin/assistant?${next.toString()}`;}} style={{width:160}}/><Button variant="outline" onClick={retry}>↻ 刷新配置</Button></div></div>
    {busy && <div className="loading-panel" data-testid="loading">正在载入助手配置…</div>}
    {!busy && error && <ErrorPanel retry={retry}/>}
    {!busy && data && <>
      {data.forceOff && <div className="force-banner" data-testid="force-off-banner"><span className="banner-warning">!</span><div><b>已被环境变量强制关闭，页面开关暂不生效</b><small>ASST_FORCE_OFF = true · 环境级优先权高于所有页面配置，请联系平台运维处理。</small></div></div>}
      {banner && <div className="success-tip" role="status">✓ {banner}<button onClick={()=>setBanner(null)} aria-label="关闭提示">×</button></div>}
      <div className="overview-strip"><div className="overview-title"><span className="overview-symbol">✧</span><div><strong>助手服务概览</strong><small>配置快照 · 实时模拟数据</small></div></div><div className="overview-status">当前生效状态 <LiveStatus data={data}/></div></div>
      <Stats data={data}/>
      <div className="panel" data-testid="configuration-panel"><div className="panel-header"><div><h2>助手配置</h2><p>统一管理已注册工具及多层级关停策略</p></div><span className="modified-label">最近更新：2026-11-23 09:45</span></div>
      <Tabs value={tab} onChange={v=>setTab(String(v))} className="admin-tabs">
        <Tabs.TabPanel value="tools" label="工具管理">
          <div className="tab-content" data-testid="tools-tab">
            <div className="table-toolbar"><div><h3>工具注册表 <span className="count-badge">{data.tools.length}</span></h3><p>工具启停、角色范围及超时修改均需要填写原因</p></div><Input placeholder="搜索工具名称、name 或模块" value={filter} onChange={v=>setFilter(v)} clearable style={{width:280}} data-testid="tool-search"/></div>
            <div className="table-scroll"><table className="tools-table"><thead><tr><th>工具名称 / NAME</th><th>提供模块</th><th>版本</th><th>副作用</th><th>需确认</th><th>超时</th><th>近7天调用 / 失败率</th><th>启用</th><th>可见角色</th><th>操作</th></tr></thead><tbody>
              {visible.map(t=><tr key={t.id} data-testid={`tool-row-${t.id}`}><td className="tool-name"><strong>{t.displayName}</strong><code>{t.name}</code></td><td>{t.module}</td><td className="mono">{t.version}</td><td><SideEffectTag kind={t.sideEffect}/></td><td>{t.confirmationRequired?<span className="yes-dot">● 需要</span>:<span className="neutral">无需</span>}</td><td className="mono">{t.timeoutMs.toLocaleString()}<small> ms</small></td><td className="mono">{t.calls7d.toLocaleString()} <span className="separator">/</span> <span className={t.failures7d/t.calls7d>0.03?'rate-warning':'rate-ok'}>{failureRate(t)}</span></td><td><Switch data-testid={`toggle-${t.id}`} value={t.enabled} disabled={data.forceOff} onChange={v=>start({kind:'toolEnabled',toolId:t.id,enabled:Boolean(v)})}/></td><td className="roles-cell">{t.visibleRoles.slice(0,2).map(role=><span className="role-chip" key={role}>{roleLabel(role)}</span>)}{t.visibleRoles.length>2&&<span className="role-chip muted-chip">+{t.visibleRoles.length-2}</span>}</td><td><div className="row-actions"><Button size="small" variant="text" theme="primary" disabled={data.forceOff} onClick={()=>openRoles(t)}>角色</Button><Button size="small" variant="text" theme="primary" disabled={data.forceOff} onClick={()=>openTimeout(t)}>超时</Button></div></td></tr>)}
              {visible.length===0&&<tr><td colSpan={10} className="empty-table">没有匹配的工具</td></tr>}
            </tbody></table></div>
            <div className="table-footer"><span>共 {visible.length} 条工具数据</span><span><span className="mini-live"/> 只读 Mock API · 接入 S2-WB / S2-IAM 后由后端鉴权</span></div>
          </div>
        </Tabs.TabPanel>
        <Tabs.TabPanel value="switches" label="关停开关">
          <div className="tab-content" data-testid="switches-tab"><div className="global-control"><div className="global-icon">◉</div><div className="global-main"><strong>全局助手开关</strong><p>关闭后，所有站点、角色和工具立即停止生效。关闭需要原因和二次确认。</p></div><div className="global-right"><span>{data.globalEnabled?'已开启':'已关闭'}</span><Switch data-testid="global-switch" disabled={data.forceOff} value={data.globalEnabled} onChange={v=>start({kind:'global',enabled:Boolean(v)})}/></div></div>
            <div className="scope-intro"><div><h3>分级关停策略</h3><p>站点、角色、工具级条目；关闭任意匹配项即可限制目标。</p></div><span className="scope-status">{data.overrides.length} 条生效规则</span></div>
            <div className="add-rule"><Select size="medium" value={overrideScope} disabled={data.forceOff} options={[{label:'站点',value:'site'},{label:'角色',value:'role'},{label:'工具',value:'tool'}]} onChange={v=>{const scope=v as Override['scope'];setOverrideScope(scope);setOverrideTarget(scope==='site'?'site-01':scope==='role'?'operator':data.tools[0]?.name??'');}} style={{width:145}} data-testid="scope-select"/><Select value={overrideTarget} disabled={data.forceOff} options={targetOptions} onChange={v=>setOverrideTarget(String(v))} style={{width:240}} data-testid="target-select"/><label className="add-state-label"><Switch value={overrideEnabled} disabled={data.forceOff} onChange={v=>setOverrideEnabled(Boolean(v))}/>{overrideEnabled?'放行':'关停'}</label><Button theme="primary" data-testid="add-rule" disabled={data.forceOff} onClick={addOverride}>＋ 新增条目</Button></div>
            <div className="scope-table"><table><thead><tr><th>级别</th><th>目标</th><th>配置状态</th><th>操作</th></tr></thead><tbody>{data.overrides.map(o=><tr key={o.id}><td><span className="scope-chip">{scopeLabels[o.scope]}</span></td><td>{o.scope==='role'?roleLabel(o.targetId):o.scope==='site'?SITES.find(s=>s.value===o.targetId)?.label??o.targetId:data.tools.find(t=>t.name===o.targetId)?.displayName??o.targetId}</td><td>{o.enabled?<Tag theme="success" variant="light">放行</Tag>:<Tag theme="warning" variant="light">关停</Tag>}</td><td><Button size="small" variant="text" theme="danger" disabled={data.forceOff} onClick={()=>start({kind:'overrideDelete',overrideId:o.id})}>删除</Button></td></tr>)}</tbody></table></div>
            <div className="scope-effective" data-testid="switch-state"><div><strong>当前生效状态</strong><p>环境变量最高优先；其次全局、工具启停及匹配的站点/角色/工具规则。</p></div><LiveStatus data={data} testId="switch-effective-state"/></div>
          </div>
        </Tabs.TabPanel>
      </Tabs></div>
      <div className="audit-card" data-testid="audit-list"><div className="audit-heading"><div><h2>最近变更记录</h2><p>展示最新 20 条配置审计，所有数据仅为虚构示例</p></div><span className="audit-count">最新 {Math.min(data.audits.length,20)} 条</span></div><div className="audit-table"><table><thead><tr><th>时间</th><th>操作人角色</th><th>范围</th><th>变更内容</th><th>原因</th></tr></thead><tbody>{data.audits.slice(0,20).map(a=><tr key={a.id}><td className="mono">{new Date(a.at).toLocaleString('zh-CN',{hour12:false,timeZone:'Asia/Shanghai'})}</td><td>{roleLabel(a.actorRole)}</td><td>{a.scope}</td><td>{a.detail}</td><td>{a.reason}</td></tr>)}</tbody></table></div></div>
      <div className="bottom-note"><span>MEMBERSPACE / ASSISTANT ADMIN</span><NoPermissionRoleTestHint/></div>
    </>}
  </main>
  <Dialog visible={Boolean(selectedAction)} onClose={cancel} onConfirm={commit} header={dialogStep==='double-confirm'?'二次确认：关闭全局助手': '修改助手配置'} confirmBtn={dialogStep==='double-confirm'?'确认关闭':'保存修改'} cancelBtn="取消" width={540} closeOnOverlayClick={false}>
    {selectedAction && <div className="edit-dialog" data-testid="reason-dialog">
      {dialogStep==='double-confirm'?<div className="double-confirm" data-testid="double-confirm">确认关闭全局助手？所有助手工具都将停止生效。此操作已填写原因，确认后记录审计。</div>:<>
        <p className="dialog-description">{selectedAction.kind==='global'?'修改全局助手运行状态':selectedAction.kind==='toolRoles'?'编辑工具可见角色':selectedAction.kind==='toolTimeout'?'修改工具超时':selectedAction.kind==='toolEnabled'?'切换工具启用状态':selectedAction.kind==='overrideAdd'?'新增分级开关':'删除分级开关'}。提交后会生成操作审计记录。</p>
        {editingTimeout&&<div className="field"><label>超时时长（毫秒）</label><Input data-testid="timeout-input" value={timeoutDraft} onChange={v=>{setTimeoutDraft(v);setSelectedAction(a=>a&&a.kind==='toolTimeout'?{...a,timeoutMs:Number(v)}:a);}}/><small className={!timeoutValid?'field-error':''}>{timeoutValid?'允许范围：1000–30000 毫秒，必须是整数':'超时必须为1000–30000毫秒的整数'}</small></div>}
        {editingRoles&&<div className="field"><label>可见角色（多选）</label><div data-testid="roles-select"><Select multiple value={rolesDraft} options={[...ROLES]} onChange={v=>{const roles=(Array.isArray(v)?v:[]).map(String) as Role[];setRolesDraft(roles);setSelectedAction(a=>a&&a.kind==='toolRoles'?{...a,roles}:a);}}/></div>{!rolesValid&&<small className="field-error">至少选择一个角色</small>}</div>}
      </>}
      <div className="field"><label>修改原因 <b className="required">*</b></label><Input data-testid="reason-input" placeholder="请填写此次变更的原因（必填，最多200字）" maxlength={200} value={reason} onChange={v=>{setReason(v);setDialogError('');}} disabled={dialogStep==='double-confirm'}/><small>保留为最新20条审计记录的一部分</small></div>
      {(dialogError||!timeoutValid||!rolesValid)&&<div role="alert" className="field-error">{dialogError||(!timeoutValid?'超时范围校验失败':'角色不能为空')}</div>}
    </div>}
  </Dialog>
  </Shell>;
}

export { getSeed };
