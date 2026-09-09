import { getSessionUser } from '@/auth/session';
import { ok, toErrorResponse } from '@/security/http';

export const dynamic = 'force-dynamic';

/** GET /api/auth/me — session + role resolution for client components. */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return ok({ authenticated: false });
    }
    return ok({
      authenticated: true,
      user: {
        id: user.appUser.id,
        name: user.appUser.name,
        email: user.appUser.email,
        roles: user.roles,
        permissions: user.permissions,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
