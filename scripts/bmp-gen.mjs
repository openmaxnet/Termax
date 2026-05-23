/**
 * 生成 Termax 安装器品牌图（BMP 格式）
 * 暗色主题：背景 #121314，强调色 #2f81f7
 *
 * 用法：node scripts/bmp-gen.mjs
 * 产物：installer/header.bmp (150x57), installer/sidebar.bmp (164x314)
 *
 * 生成的是纯色占位图，建议后续用设计工具（Figma/Photoshop）替换为正式版
 */
import { writeFileSync, mkdirSync } from 'fs'

// BMP 24-bit writer
function bmp(width, height, fill) {
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const pixelData = Buffer.alloc(rowSize * height, 0)
  const r = parseInt(fill.slice(0,2), 16)
  const g = parseInt(fill.slice(2,4), 16)
  const b = parseInt(fill.slice(4,6), 16)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const off = y * rowSize + x * 3
      pixelData[off] = b     // BMP is BGR
      pixelData[off + 1] = g
      pixelData[off + 2] = r
    }
  }
  const fileSize = 54 + pixelData.length
  const buf = Buffer.alloc(fileSize)
  // BMP header
  buf.write('BM', 0)
  buf.writeUInt32LE(fileSize, 2)
  buf.writeUInt32LE(54, 10) // data offset
  buf.writeUInt32LE(40, 14) // DIB header size
  buf.writeInt32LE(width, 18)
  buf.writeInt32LE(height, 22)
  buf.writeUInt16LE(1, 26)  // planes
  buf.writeUInt16LE(24, 28) // bpp
  buf.writeUInt32LE(pixelData.length, 34) // image size
  // pixel data (BMP stores bottom-to-top)
  pixelData.copy(buf, 54)
  return buf
}

// 带左侧强调色条的 BMP
function bmpWithAccent(width, height, bg, accent) {
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const pixelData = Buffer.alloc(rowSize * height, 0)
  const bgR = parseInt(bg.slice(0,2), 16)
  const bgG = parseInt(bg.slice(2,4), 16)
  const bgB = parseInt(bg.slice(4,6), 16)
  const acR = parseInt(accent.slice(0,2), 16)
  const acG = parseInt(accent.slice(2,4), 16)
  const acB = parseInt(accent.slice(4,6), 16)
  const accentW = 4
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const off = y * rowSize + x * 3
      const isAccent = x < accentW || x >= width - accentW
      pixelData[off]     = isAccent ? acB : bgB
      pixelData[off + 1] = isAccent ? acG : bgG
      pixelData[off + 2] = isAccent ? acR : bgR
    }
  }
  const fileSize = 54 + pixelData.length
  const buf = Buffer.alloc(fileSize)
  buf.write('BM', 0)
  buf.writeUInt32LE(fileSize, 2)
  buf.writeUInt32LE(54, 10)
  buf.writeUInt32LE(40, 14)
  buf.writeInt32LE(width, 18)
  buf.writeInt32LE(height, 22)
  buf.writeUInt16LE(1, 26)
  buf.writeUInt16LE(24, 28)
  buf.writeUInt32LE(pixelData.length, 34)
  pixelData.copy(buf, 54)
  return buf
}

mkdirSync('src-tauri/installer', { recursive: true })

// Header: 150x57, 暗色背景 + 左右强调条
writeFileSync('src-tauri/installer/header.bmp', bmpWithAccent(150, 57, '121314', '2f81f7'))
console.log('✅ src-tauri/installer/header.bmp (150×57) — 暗色背景 + 强调色边框')

// Sidebar: 164x314, 暗色背景 + 左侧强调条
writeFileSync('src-tauri/installer/sidebar.bmp', bmpWithAccent(164, 314, '121314', '2f81f7'))
console.log('✅ src-tauri/installer/sidebar.bmp (164×314) — 暗色背景 + 强调色边框')
