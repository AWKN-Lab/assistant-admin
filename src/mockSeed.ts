import type { Settings, Tool, Role } from './policy.ts';
const sample: Tool[] = [
  { id: 't1', displayName: '企业画像查询', name: 'company.profile.search', module: '会员数据中台', version: 'v2.4.1', sideEffect: 'read', confirmationRequired: false, timeoutMs: 8000, enabled: true, visibleRoles: ['system_admin','operator','sales'], calls7d: 842, failures7d: 13 },
  { id: 't2', displayName: '商机线索匹配', name: 'lead.matching', module: '商机流转', version: 'v1.8.0', sideEffect: 'read', confirmationRequired: false, timeoutMs: 12000, enabled: true, visibleRoles: ['system_admin','sales'], calls7d: 603, failures7d: 21 },
  { id: 't3', displayName: '发送合作邀请', name: 'connection.invite.send', module: '资源对接', version: 'v1.3.2', sideEffect: 'external', confirmationRequired: true, timeoutMs: 15000, enabled: false, visibleRoles: ['system_admin','operator'], calls7d: 184, failures7d: 7 },
  { id: 't4', displayName: 'SOP 智能检索', name: 'knowledge.sop.retrieve', module: '知识库工作台', version: 'v3.0.1', sideEffect: 'read', confirmationRequired: false, timeoutMs: 5000, enabled: true, visibleRoles: ['system_admin','operator','member_service'], calls7d: 1924, failures7d: 29 },
  { id: 't5', displayName: '客户档案更新', name: 'crm.contact.update', module: 'CRM 服务', version: 'v2.1.4', sideEffect: 'write', confirmationRequired: true, timeoutMs: 10000, enabled: true, visibleRoles: ['system_admin','operator'], calls7d: 415, failures7d: 5 },
  { id: 't6', displayName: '会议室预订查询', name: 'site.room.availability', module: '场地运营', version: 'v1.6.0', sideEffect: 'read', confirmationRequired: false, timeoutMs: 7000, enabled: true, visibleRoles: ['system_admin','operator','member_service','member'], calls7d: 1312, failures7d: 12 },
];
export const SITES = [{ label: '滨江站点', value: 'site-01' }, { label: '科技园站点', value: 'site-02' }, { label: '商务中心站点', value: 'site-03' }];
export const MOCK_ACTOR: Role = 'system_admin';
export function getSeed(mode: string, runtimeForced = false): Settings {
  return {
    globalEnabled: mode !== 'globalOff',
    forceOff: runtimeForced || mode === 'forceOff',
    tools: sample.map(t => ({...t, visibleRoles: [...t.visibleRoles]})),
    overrides: [
      { id: 'site-default', scope: 'site', targetId: 'site-03', enabled: false },
      { id: 'role-default', scope: 'role', targetId: 'member', enabled: false },
      { id: 'tool-default', scope: 'tool', targetId: 'connection.invite.send', enabled: false },
    ],
    audits: Array.from({ length: 8 }, (_, i) => ({ id: `seed-${i}`, at: new Date(Date.UTC(2026, 10, 23, 1, 45 - i * 26)).toISOString(), actorRole: i % 2 ? '系统管理员' : '运维管理员', scope: i % 3 === 0 ? '全局' : i % 3 === 1 ? '站点' : '工具', reason: ['服务升级前隔离','例行权限复核','版本窗口调整'][i % 3], detail: ['调整工具可见范围','切换站点策略','关闭高风险工具'][i % 3] })),
  };
}

