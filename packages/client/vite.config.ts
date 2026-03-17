import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],

    // Environment variables exposed to client
    define: {
      'import.meta.env.VITE_WS_URL': JSON.stringify(
        env.VITE_WS_URL || 'ws://localhost:3000'
      ),
      'import.meta.env.VITE_API_URL': JSON.stringify(
        env.VITE_API_URL || 'http://localhost:3000'
      ),
    },

    server: {
      port: 5174,
      proxy: {
        // Development: proxy WebSocket to local server
        '/ws': {
          target: env.VITE_WS_URL || 'ws://localhost:3000',
          ws: true,
          changeOrigin: true,
        },
        // Development: proxy API to local server
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },

    build: {
      // Output directory
      outDir: 'dist',

      // Sourcemaps for debugging (disable in production if needed)
      sourcemap: mode !== 'production',

      // Rollup options
      rollupOptions: {
        output: {
          // Chunk splitting for better caching
          manualChunks: {
            pixi: ['pixi.js'],
            react: ['react', 'react-dom'],
          },
        },
      },
    },

    // Optimize dependencies
    optimizeDeps: {
      include: ['pixi.js', 'react', 'react-dom'],
    },
  };
});
