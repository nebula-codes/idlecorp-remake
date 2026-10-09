import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ root: import.meta.dirname, plugins: [react()], base: './', server: { host: '0.0.0.0', port: 5173, proxy: { '/api': 'http://127.0.0.1:3001' } }, build: { outDir: 'dist', emptyOutDir: true } });
