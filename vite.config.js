import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/community': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
});
