import type { AIProvider } from '@/ai/provider';
import { opportunityRepository } from '@/repositories/supabase';
import { OPPORTUNITY_STAGES } from './stage-constants';
import type { Agent, AgentResult } from './types';

/** Sales Agent (spec §36, ACTIVE): pipeline analysis and prioritization. */
export const salesAgent: Agent = {
  name: 'sales',
  taskType: 'sales',
  description: 'Pipeline analysis, opportunity prioritization, next-action suggestions.',

  async handle(_command: string, _user, _provider: AIProvider): Promise<AgentResult> {
    const opportunities = await opportunityRepository.list({ limit: 500 });
    const open = opportunities.filter((o) => !['won', 'lost'].includes(o.stage));

    const byStage: Record<string, { count: number; value: number }> = {};
    for (const stage of OPPORTUNITY_STAGES) byStage[stage] = { count: 0, value: 0 };
    for (const opp of open) {
      byStage[opp.stage].count += 1;
      byStage[opp.stage].value += Number(opp.estimated_value ?? 0);
    }

    const pipelineValue = open.reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0);
    const weightedValue = open.reduce(
      (sum, o) => sum + (Number(o.estimated_value ?? 0) * (o.probability ?? 0)) / 100,
      0,
    );

    const needsAttention = open
      .filter((o) => {
        const stale = o.next_action == null;
        const overdue = o.expected_close_date ? new Date(o.expected_close_date) < new Date() : false;
        return stale || overdue;
      })
      .slice(0, 10);

    return {
      summary: `Pipeline: ${open.length} open opportunities worth ${pipelineValue.toLocaleString('en-IN')} (weighted ${Math.round(weightedValue).toLocaleString('en-IN')}).`,
      data: {
        open_count: open.length,
        pipeline_value: pipelineValue,
        weighted_value: weightedValue,
        by_stage: byStage,
        needs_attention: needsAttention.map((o) => ({
          id: o.id,
          name: o.name,
          stage: o.stage,
          value: o.estimated_value,
          expected_close_date: o.expected_close_date,
          issue: o.expected_close_date && new Date(o.expected_close_date) < new Date() ? 'past expected close date' : 'no next action defined',
        })),
      },
      recommended_actions: needsAttention.slice(0, 3).map((o) => `Define the next action for "${o.name}" (${o.stage}).`),
      approval_required: false,
    };
  },
};
