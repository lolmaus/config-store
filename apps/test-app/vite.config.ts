import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {tanstackRouter} from '@tanstack/router-plugin/vite';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  resolve: {
    alias: {
      // Force Vite to read the SOURCE, not the build
      '@config-store/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@config-store/react': path.resolve(__dirname, '../../packages/react/src/index.ts'),
    },
  },
});
