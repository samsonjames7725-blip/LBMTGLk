import { ForbiddenError, UnauthorizedError } from '@/security/http';
import { createClient } from '@/supabase/auth-server';
import { tryGetAdminClient } from '@/supabase/server';
import { permissionsForRoles, type Permission } from './permissions';
import type { AppUser } from '@/types/database';

export interface SessionUser {
  authUserId: string;
  email: string;
  appUser: AppUser;
  roles: string[];
  permissions: Permission[];
}

/**
 * Resolves the signed-in Supabase Auth user to an active internal app user
 * with roles/permissions. Returns null when not signed in, when no
 * provisioned app user matches, or when the account is inactive/suspended.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = tryGetAdminClient();
  if (!admin) return null;

  const { data: appUser } = await admin
    .from('users')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle<AppUser>();
  if (!appUser || appUser.status !== 'active') return null;

  const { data: roleRows } = await admin
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', appUser.id);

  const roles = (roleRows ?? [])
    .map((row) => (row as unknown as { roles: { name: string } | null }).roles?.name)
    .filter((name): name is string => Boolean(name));

  return {
    authUserId: user.id,
    email: appUser.email,
    appUser,
    roles,
    permissions: permissionsForRoles(roles),
  };
}

/**
 * Guard for route handlers. Throws Unauthorized/Forbidden (mapped to safe
 * error responses by toErrorResponse at the route boundary).
 */
export async function requireApiUser(permission?: Permission): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  if (permission && !user.permissions.includes(permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
  return user;
}

/** Guard for server components: same resolution, no HTTP error mapping. */
export { getSessionUser as getServerUser };
