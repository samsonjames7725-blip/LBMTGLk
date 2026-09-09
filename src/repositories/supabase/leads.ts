import type { Lead } from '@/types/database';
import type { LeadFilters, LeadRepository, ListResult } from '../types';
import { dbError, supabaseTable } from './generic';
import { getAdminClient } from '@/supabase/server';

const table = 'leads';
const crud = supabaseTable<Lead>(table);

export class SupabaseLeadRepository implements LeadRepository {
  async list(filters: LeadFilters = {}): Promise<ListResult<Lead>> {
    const {
      search,
      status,
      temperature,
      source,
      sort = 'created_at',
      order = 'desc',
      limit = 50,
      offset = 0,
    } = filters;

    let query = getAdminClient().from(table).select('*', { count: 'exact' });
    if (status) query = query.eq('status', status);
    if (temperature) query = query.eq('lead_temperature', temperature);
    if (source) query = query.eq('source', source);
    if (search) {
      const safe = search.replace(/[%,]/g, '');
      query = query.or(`company.ilike.%${safe}%,contact_name.ilike.%${safe}%,email.ilike.%${safe}%`);
    }
    query = query.order(sort, { ascending: order === 'asc' }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw dbError(`${table}.list`, error);
    return { items: (data ?? []) as Lead[], total: count ?? data?.length ?? 0 };
  }

  getById = crud.getById;
  create = crud.create;
  update = crud.update;

  async findByEmail(email: string): Promise<Lead | null> {
    const { data, error } = await getAdminClient()
      .from(table)
      .select('*')
      .eq('email', email.toLowerCase())
      .limit(1)
      .maybeSingle<Lead>();
    if (error) throw dbError(`${table}.findByEmail`, error);
    return data ?? null;
  }
}
