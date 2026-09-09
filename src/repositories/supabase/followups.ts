import type { Followup } from '@/types/database';
import type { FollowupRepository } from '../types';
import { dbError, supabaseTable } from './generic';
import { getAdminClient } from '@/supabase/server';

const table = 'followups';
const crud = supabaseTable<Followup>(table);

export class SupabaseFollowupRepository implements FollowupRepository {
  async list(
    opts: {
      status?: Followup['status'];
      scheduledFrom?: string;
      scheduledTo?: string;
      leadId?: string;
      limit?: number;
    } = {},
  ): Promise<Followup[]> {
    let query = getAdminClient()
      .from(table)
      .select('*')
      .order('scheduled_at', { ascending: true })
      .limit(opts.limit ?? 100);
    if (opts.status) query = query.eq('status', opts.status);
    if (opts.scheduledFrom) query = query.gte('scheduled_at', opts.scheduledFrom);
    if (opts.scheduledTo) query = query.lte('scheduled_at', opts.scheduledTo);
    if (opts.leadId) query = query.eq('lead_id', opts.leadId);
    const { data, error } = await query;
    if (error) throw dbError(`${table}.list`, error);
    return (data ?? []) as Followup[];
  }

  getById = crud.getById;
  create = crud.create;
  update = crud.update;

  async markOverdue(): Promise<number> {
    const { data, error } = await getAdminClient()
      .from(table)
      .update({ status: 'overdue' })
      .eq('status', 'pending')
      .lt('scheduled_at', new Date().toISOString())
      .select('id');
    if (error) throw dbError(`${table}.markOverdue`, error);
    return data?.length ?? 0;
  }
}
