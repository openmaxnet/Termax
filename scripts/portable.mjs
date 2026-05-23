// 构建后重命名便携版二进制：termax.exe → Termax-portable-v0.1.0.exe
import { copyFileSync } from 'fs';
import { readFileSync } from 'fs';

const toml = readFileSync('src-tauri/Cargo.toml', 'utf-8');
const ver = toml.match(/version\s*=\s*"([^"]+)"/)?.[1] ?? '0.0.0';
const src = 'src-tauri/target/release/termax.exe';
const dest = `Termax-portable-v${ver}.exe`;

copyFileSync(src, dest);
console.log(`✅ Portable: ${dest}`);
