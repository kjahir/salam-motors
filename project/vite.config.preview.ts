import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
// TEMPORARY: visual-preview config, mocks the data layer. Delete with src/__preview__.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: [
    { find: /(^@\/lib\/supabase$)|(\/lib\/supabase$)|(^\.\/supabase$)/, replacement: fileURLToPath(new URL('./src/__preview__/mockSupabase.ts', import.meta.url)) },
    { find: /(^@\/lib\/queries$)|(^\.\/queries$)/, replacement: fileURLToPath(new URL('./src/__preview__/mockQueries.ts', import.meta.url)) },
    { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
  ] },
  optimizeDeps: { exclude: ['lucide-react'] },
  server: { port: 5199 },
});
