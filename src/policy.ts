/* Shared, side-effect-free policy. The S2-IAM backend must enforce the same rules. */
export const ROLES = [
  { label: '系统管理员', value: 'system_admin' },
  { label: '运营经理', value: 'operator' },
  { label: '招商专员', value: 'sales' },
  { label: '会员服务', value: 'member_service' },
  { label: '会员企业', value: 'member' },
] as const;
export type Role = typeof ROLES[number]['value'];
export type Scope = 'global' | 'site' | 'role' | 'tool';
export type SideEffect = 'none' | 'read' | 'write' | 'external';
export type Tool = {
  id: string; displayName: string; name: string; module: string; version: string;
  sideEffect: SideEffect; confirmationRequired: boolean; timeoutMs: number;
  enabled: boolean; visibleRoles: Role[]; calls7d: number; failures7d: number;
};
export type Override = { id: string; scope: Exclude<Scope, 'global'>; targetId: string; enabled: boolean };
export type Audit = { id: string; at: string; actorRole: string; scope: string; reason: string; detail: string };
export type Settings = { globalEnabled: boolean; forceOff: boolean; tools: Tool[]; overrides: Override[]; audits: Audit[] };
export type Mutation =
  | { kind: 'global'; enabled: boolean }
  | { kind: 'toolEnabled'; toolId: string; enabled: boolean }
  | { kind: 'toolRoles'; toolId: string; roles: Role[] }
  | { kind: 'toolTimeout'; toolId: string; timeoutMs: number }
  | { kind: 'overrideAdd'; scope: Override['scope']; targetId: string; enabled: boolean }
  | { kind: 'overrideDelete'; overrideId: string };

export const isAdmin = (role: string | null): role is 'system_admin' => role === 'system_admin';
export const isForceOff = (env: string | boolean | null | undefined): boolean =>
  env === true || (typeof env === 'string' && /^(true|1|yes|on)$/i.test(env.trim()));
export const validReason = (reason: unknown): reason is string =>
  typeof reason === 'string' && reason.trim().length > 0 && reason.trim().length <= 200;
export const validTimeout = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1000 && value <= 30000;
export const validRoles = (value: readonly string[]): value is Role[] =>
  value.length > 0 && value.length === new Set(value).size && value.every(v => ROLES.some(role => role.value === v));
export const roleLabel = (value: string): string => ROLES.find(x => x.value === value)?.label ?? value;
export const failureRate = (tool: Tool): string => tool.calls7d ? `${(tool.failures7d * 100 / tool.calls7d).toFixed(1)}%` : '0.0%';

/* Forced switch overrides all user-controlled switches, even if the UI is stale. */
export function effectiveState(s: Settings, tool: Tool, siteId: string, role: Role): { enabled: boolean; reason: string } {
  if (s.forceOff) return { enabled: false, reason: '环境变量强制关闭' };
  if (!s.globalEnabled) return { enabled: false, reason: '全局关停' };
  if (!tool.enabled) return { enabled: false, reason: '工具停用' };
  if (!tool.visibleRoles.includes(role)) return { enabled: false, reason: '角色不可见' };
  const disabled = s.overrides.find(o => !o.enabled && (
    (o.scope === 'site' && o.targetId === siteId) ||
    (o.scope === 'role' && o.targetId === role) ||
    (o.scope === 'tool' && o.targetId === tool.name)
  ));
  return disabled ? { enabled: false, reason: `${disabled.scope} 范围关停` } : { enabled: true, reason: '正常' };
}

let seq = 0;
export function applyMutation(s: Settings, mutation: Mutation, reason: string, actorRole: string, at: string): Settings {
  if (!isAdmin(actorRole)) throw new Error('仅系统管理员可修改');
  if (s.forceOff) throw new Error('环境变量强制关闭期间禁止修改页面开关');
  if (!validReason(reason)) throw new Error('必须填写修改原因，最长200字');
  let detail = ''; let scope = ''; let tools = s.tools; let overrides = s.overrides;
  let globalEnabled = s.globalEnabled;
  const mutateTool = (toolId: string, fn: (t: Tool) => Tool): void => {
    if (!tools.some(t => t.id === toolId)) throw new Error('工具不存在');
    tools = tools.map(t => t.id === toolId ? fn(t) : t);
  };
  switch (mutation.kind) {
    case 'global':
      globalEnabled = mutation.enabled; scope = '全局'; detail = mutation.enabled ? '恢复全局助手' : '关闭全局助手'; break;
    case 'toolEnabled':
      mutateTool(mutation.toolId, t => ({ ...t, enabled: mutation.enabled }));
      scope = `工具 / ${mutation.toolId}`; detail = mutation.enabled ? '启用工具' : '停用工具'; break;
    case 'toolRoles':
      if (!validRoles(mutation.roles)) throw new Error('至少选择一个有效且不重复的角色');
      mutateTool(mutation.toolId, t => ({ ...t, visibleRoles: [...mutation.roles] }));
      scope = `工具 / ${mutation.toolId}`; detail = `可见角色：${mutation.roles.map(roleLabel).join('、')}`; break;
    case 'toolTimeout':
      if (!validTimeout(mutation.timeoutMs)) throw new Error('超时必须为1000–30000毫秒的整数');
      mutateTool(mutation.toolId, t => ({ ...t, timeoutMs: mutation.timeoutMs }));
      scope = `工具 / ${mutation.toolId}`; detail = `超时调整为 ${mutation.timeoutMs}ms`; break;
    case 'overrideAdd':
      if (!['site', 'role', 'tool'].includes(mutation.scope) || !mutation.targetId.trim()) throw new Error('无效的范围或目标');
      if (overrides.some(o => o.scope === mutation.scope && o.targetId === mutation.targetId)) throw new Error('该范围条目已经存在');
      overrides = [...overrides, { id: `ov-${Date.now()}-${seq++}`, scope: mutation.scope, targetId: mutation.targetId, enabled: mutation.enabled }];
      scope = `${mutation.scope} / ${mutation.targetId}`; detail = `新增${mutation.enabled ? '放行' : '关停'}条目`; break;
    case 'overrideDelete': {
      const found = overrides.find(o => o.id === mutation.overrideId);
      if (!found) throw new Error('待删除条目不存在');
      overrides = overrides.filter(o => o.id !== found.id);
      scope = `${found.scope} / ${found.targetId}`; detail = '删除关停条目'; break;
    }
    default: { const unhandled: never = mutation; throw new Error(`无效修改: ${unhandled}`); }
  }
  const audit: Audit = { id: `audit-${Date.now()}-${seq++}`, at, actorRole, scope, reason: reason.trim(), detail };
  return { ...s, globalEnabled, tools, overrides, audits: [audit, ...s.audits].slice(0, 20) };
}
