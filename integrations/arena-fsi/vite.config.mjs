import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('./ui',import.meta.url)),base:'./',build:{outDir:'../dist',emptyOutDir:true,rollupOptions:{input:fileURLToPath(new URL('./ui/arena.html',import.meta.url))}},server:{host:'127.0.0.1',proxy:{'/api':'http://127.0.0.1:4174'}}});
