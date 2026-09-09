import { redirect } from 'next/navigation';
import { getSessionUser } from '@/auth/session';

export default async function Home() {
  const user = await getSessionUser().catch(() => null);
  redirect(user ? '/dashboard' : '/login');
}
