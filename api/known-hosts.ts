// 动态主机记忆：/api/generate 返回的图片 URL 域名记入内存，
// /api/download 放行「默认白名单 ∪ 动态记录」——上游换 CDN 域名也不会误拒。
// SSRF 面有限：只有智谱上游实际返回过的域名才会被记住。
const knownHosts = new Set<string>();

export function rememberImageHost(url: string): void {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host) knownHosts.add(host);
  } catch {
    // 非法 URL 忽略
  }
}

export function isKnownImageHost(host: string): boolean {
  return knownHosts.has(host.toLowerCase());
}

export function knownHostsSnapshot(): string[] {
  return [...knownHosts].sort();
}
