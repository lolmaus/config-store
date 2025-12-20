import {defineConfig} from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['esm', 'cjs'], // Build both ES Modules and CommonJS
  outDir: 'dist',
  clean: true, // Delete dist/ before building
  dts: true, // Generate type definitions (.d.ts)
  tsconfig: './tsconfig.lib.json',
});
