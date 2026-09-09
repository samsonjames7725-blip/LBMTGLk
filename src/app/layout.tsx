import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'LifeBridge MedTech AI Business OS',
    template: '%s · LifeBridge AI OS',
  },
  description:
    'LifeBridge MedTech AI Business Operating System — CRM, AI agents, human approvals, analytics.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
