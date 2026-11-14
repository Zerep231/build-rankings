// Resolves user ids to Minecraft names (profiles), cached for the page's lifetime.
const cache = new Map();

export async function namesFor(client, ids) {
  const missing = [...new Set(ids)].filter((id) => id && !cache.has(id));
  if (client && missing.length) {
    for (let i = 0; i < missing.length; i += 100) {
      const { data } = await client.from("profiles").select("id,username").in("id", missing.slice(i, i + 100));
      for (const p of data || []) cache.set(p.id, p.username);
    }
    for (const id of missing) if (!cache.has(id)) cache.set(id, null);
  }
  return (id) => cache.get(id) || "Người chơi";
}
