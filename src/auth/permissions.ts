export const PERMISSIONS = [
  'crm.read',
  'crm.write',
  'leads.delete',
  'approvals.review',
  'approvals.request',
  'ai.run',
  'knowledge.manage',
  'users.manage',
  'settings.manage',
  'analytics.read',
  'audit.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Configurable role → permission matrix (spec §12/§13). Server-side checks
 * use this map; RLS provides defense in depth at the database layer.
 */
export const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: [
    'crm.read',
    'crm.write',
    'approvals.review',
    'approvals.request',
    'ai.run',
    'knowledge.manage',
    'users.manage',
    'settings.manage',
    'analytics.read',
    'audit.read',
  ],
  sales: ['crm.read', 'crm.write', 'approvals.request', 'ai.run', 'analytics.read'],
  marketing: ['crm.read', 'ai.run', 'analytics.read'],
  operations: ['crm.read', 'crm.write', 'approvals.request', 'ai.run', 'analytics.read'],
  viewer: ['crm.read'],
};

export function permissionsForRoles(roles: readonly string[]): Permission[] {
  const set = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) set.add(permission);
  }
  return [...set];
}

export function hasPermission(permissions: readonly Permission[], required: Permission): boolean {
  return permissions.includes(required);
}
