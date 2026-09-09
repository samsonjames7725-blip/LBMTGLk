import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 font-bold text-white">LB</span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">LifeBridge MedTech</h1>
            <p className="text-xs text-slate-500">AI Business Operating System</p>
          </div>
        </div>
        <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-400">
          Access is limited to provisioned team members. All actions are role-controlled and audit-logged.
        </p>
      </div>
    </main>
  );
}
