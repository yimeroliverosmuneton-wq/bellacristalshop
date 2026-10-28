import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// La compilación se guarda en ../flujos para que GitHub Pages la publique tal cual.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: '../flujos', emptyOutDir: true },
});
