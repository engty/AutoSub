import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  shims: true,
  target: 'node18',
  outDir: 'dist',
  external: ['@modelcontextprotocol/sdk'],
  // 复制 banner.txt 到 dist 目录
  onSuccess: async () => {
    const fs = await import('fs-extra');
    await fs.copy('src/cli/banner.txt', 'dist/banner.txt');
    console.log('✓ Copied banner.txt to dist/');
  },
});
