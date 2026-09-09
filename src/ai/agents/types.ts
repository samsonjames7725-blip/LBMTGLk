import type { SessionUser } from '@/auth/session';
import type { AIProvider } from '@/ai/provider';

export interface AgentResult {
  summary: string;
  data: Record<string, unknown>;
  recommended_actions: string[];
  approval_required: boolean;
  approval_id?: string | null;
}

export interface Agent {
  name: string;
  taskType: 'lead' | 'sales' | 'followup' | 'email' | 'analytics' | 'report';
  description: string;
  handle(command: string, user: SessionUser, provider: AIProvider): Promise<AgentResult>;
}

export function textAfter(command: string, keyword: string): string | null {
  const idx = command.toLowerCase().indexOf(keyword);
  if (idx === -1) return null;
  return command.slice(idx + keyword.length).trim() || null;
}
