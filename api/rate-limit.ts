// 内存频控：每 IP 60 秒内最多 5 次（spec 2.2；serverless 重置可接受）
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;

const buckets = new Map<string, { count: number; resetAt: number }>();

// 周期性清理，防止 Map 无限增长
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < WINDOW_MS) return;
  lastSweep = now;
  for (const [ip, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(ip);
  }
}

export function checkRateLimit(ip: string): { allowed: boolean } {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }
  if (bucket.count >= MAX_REQUESTS) {
    return { allowed: false };
  }
  bucket.count += 1;
  return { allowed: true };
}
