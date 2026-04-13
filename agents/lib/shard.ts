/**
 * shard — uniform partitioning for parallel agent instances.
 * Scripts read --shard=N --shards=M from argv and partition their workload.
 */
export function parseShardArgs(): { shard: number; shards: number } {
  let shard = 0, shards = 1
  for (const a of process.argv.slice(2)) {
    const s = a.match(/^--shard=(\d+)$/); if (s) shard = parseInt(s[1], 10)
    const t = a.match(/^--shards=(\d+)$/); if (t) shards = Math.max(1, parseInt(t[1], 10))
  }
  return { shard, shards }
}

export function pickShard<T>(items: T[], shard: number, shards: number): T[] {
  if (shards <= 1) return items
  return items.filter((_, i) => i % shards === shard)
}

export function hashId(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
  return h >>> 0
}

export function belongsToShard(id: string, shard: number, shards: number): boolean {
  if (shards <= 1) return true
  return hashId(id) % shards === shard
}
