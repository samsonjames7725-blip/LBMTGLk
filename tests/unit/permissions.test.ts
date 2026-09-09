import { describe, expect, it } from 'vitest';
import { PERMISSIONS, permissionsForRoles, hasPermission } from '@/auth/permissions';

describe('RBAC permission matrix', () => {
  it('grants owner every permission', () => {
    expect(permissionsForRoles(['owner'])).toEqual([...PERMISSIONS]);
  });

  it('sales cannot review approvals or manage users', () => {
    const sales = permissionsForRoles(['sales']);
    expect(hasPermission(sales, 'crm.write')).toBe(true);
    expect(hasPermission(sales, 'approvals.review')).toBe(false);
    expect(hasPermission(sales, 'users.manage')).toBe(false);
  });

  it('viewer is read-only', () => {
    const viewer = permissionsForRoles(['viewer']);
    expect(hasPermission(viewer, 'crm.read')).toBe(true);
    expect(hasPermission(viewer, 'crm.write')).toBe(false);
    expect(hasPermission(viewer, 'ai.run')).toBe(false);
  });

  it('combines roles additively', () => {
    const combined = permissionsForRoles(['viewer', 'marketing']);
    expect(hasPermission(combined, 'ai.run')).toBe(true);
  });

  it('unknown roles contribute nothing', () => {
    expect(permissionsForRoles(['intern'])).toEqual([]);
  });
});
