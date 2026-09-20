// 一次性脚本：下载 ian-image-history-2026-09-20.json 里的图片到 public/history-images/，
// 并生成 public/seed-history.json（imageUrl 改为本地路径，永不过期）。
// 运行：npm run fetch-history（Node 18+，无需额外依赖）
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const SRC = path.join(ROOT, 'ian-image-history-2026-09-20.json');
const IMG_DIR = path.join(ROOT, 'public', 'history-images');
const SEED = path.join(ROOT, 'public', 'seed-history.json');

async function main() {
  if (!existsSync(SRC)) {
    console.error('未找到 ian-image-history-2026-09-20.json，请确认文件在项目根目录');
    process.exit(1);
  }

  const entries = JSON.parse(await readFile(SRC, 'utf-8'));
  if (!Array.isArray(entries)) {
    console.error('JSON 格式错误：顶层不是数组');
    process.exit(1);
  }

  await mkdir(IMG_DIR, { recursive: true });

  const seed = [];
  let ok = 0;
  let fail = 0;

  for (const entry of entries) {
    const name = `${entry.id}.png`;
    const dest = path.join(IMG_DIR, name);
    // 已下载过则跳过（脚本可重复执行）
    if (existsSync(dest)) {
      seed.push({ ...entry, imageUrl: `/history-images/${name}` });
      ok++;
      console.log(`跳过（已存在）: ${name}`);
      continue;
    }
    try {
      const res = await fetch(entry.imageUrl, {
        headers: { Accept: 'image/*' },
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1024) throw new Error('内容过小，疑似错误页');
      await writeFile(dest, buf);
      seed.push({ ...entry, imageUrl: `/history-images/${name}` });
      ok++;
      console.log(`已下载: ${name} (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      fail++;
      console.error(`下载失败: ${entry.id} — ${err instanceof Error ? err.message : err}`);
      console.error(`  原始 URL: ${entry.imageUrl}`);
      console.error('  （该条目将保留原始 URL 写入种子文件）');
      seed.push(entry);
    }
  }

  await writeFile(SEED, JSON.stringify(seed, null, 2), 'utf-8');
  console.log(`\n完成：成功 ${ok} 条，失败 ${fail} 条`);
  console.log(`种子文件已生成: public/seed-history.json`);
  if (fail > 0) {
    console.log('失败的条目仍指向远程 URL（过期后会显示占位提示，可重新生成）');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
