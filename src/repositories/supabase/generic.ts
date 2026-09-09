import { getAdminClient } from '@/supabase/server';

/** Wraps PostgREST errors without leaking connection details. */
export function dbError(operation: string, error: { message: string; code?: string }): Error {
  return new Error(`Database error during ${operation}: ${error.code ?? ''} ${error.message}`);
}

/**
 * Generic Supabase table repository for UUID-keyed tables whose columns map
 * 1:1 to the row type. Domain-specific repositories compose this.
 */
export function supabaseTable<T extends { id: string }>(table: string) {
  return {
    async getById(id: string): Promise<T | null> {
      const { data, error } = await getAdminClient()
        .from(table)
        .select('*')
        .eq('id', id)
        .maybeSingle<T>();
      if (error) throw dbError(`${table}.getById`, error);
      return data ?? null;
    },

    async create(dto: Partial<T>): Promise<T> {
      const { data, error } = await getAdminClient()
        .from(table)
        .insert(dto as never)
        .select('*')
        .single<T>();
      if (error) throw dbError(`${table}.create`, error);
      return data;
    },

    async update(id: string, patch: Partial<T>): Promise<T> {
      const { data, error } = await getAdminClient()
        .from(table)
        .update(patch as never)
        .eq('id', id)
        .select('*')
        .single<T>();
      if (error) throw dbError(`${table}.update`, error);
      return data;
    },
  };
}
