import { SUPABASE } from "../data/config.js";

const PAGE = 1000; // Supabase returns at most 1000 rows per request by default
let clientPromise = null;

export const supabaseConfigured = Boolean(SUPABASE.url && SUPABASE.anonKey);

export function getClient() {
  if (!supabaseConfigured) return Promise.resolve(null);
  clientPromise ??= import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
    .then(({ createClient }) => createClient(SUPABASE.url, SUPABASE.anonKey));
  return clientPromise;
}

/**
 * Loads every score row, newest first, page by page. The old site stopped at 2000 rows,
 * so totals silently dropped older scores once the history grew past that.
 */
export async function fetchAllScores(client, table = "build_history") {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      // Existing installations keep working until v3 is deployed.
      if (table === "build_history" && error.code === "PGRST205") return fetchAllScores(client, "build_scores");
      throw error;
    }
    rows.push(...(data || []));
    if (!data || data.length < PAGE) return rows;
  }
}
