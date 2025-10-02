#!/usr/bin/env node

import('../dist/index.js').catch((error) => {
  console.error('启动失败:', error.message);
  process.exit(1);
});
