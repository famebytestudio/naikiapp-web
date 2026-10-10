import { supabase } from './supabaseClient'
import { getDemoCommunity } from './listingsApi'

export async function getPublicCommunity() {
  if (!supabase) return getDemoCommunity()
  const { data, error } = await supabase.rpc('get_public_community')
  if (error) throw error
  return {
    ngos: data?.ngos ?? [],
    donors: (data?.donors ?? []).map(row => ({
      ...row, deliveries: Number(row.deliveries), deliveredKg: Number(row.deliveredKg),
    })),
  }
}
