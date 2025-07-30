/**
 * High-Performance Vite Configuration for Nixbit Frontend
 * Optimizes bundle size, loading performance, and runtime efficiency
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig as defineVitestConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react({
      // Enable React Fast Refresh for better development experience
      fastRefresh: true,
      // Optimize JSX runtime
      jsxRuntime: 'automatic',
    }),
    
    // Bundle analyzer for production builds
    ...(process.env.ANALYZE === 'true' ? [
      visualizer({
        filename: 'dist/bundle-analysis.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
      })
    ] : []),
  ],

  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@services': resolve(__dirname, 'src/services'),
      '@types': resolve(__dirname, 'src/types'),
      '@contexts': resolve(__dirname, 'src/contexts'),
    },
  },

  // Build optimizations
  build: {
    // Target modern browsers for smaller bundles
    target: 'es2020',
    
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // React ecosystem
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          
          // UI libraries
          'ui-vendor': ['@headlessui/react', '@heroicons/react'],
          
          // Data fetching and state management
          'data-vendor': ['react-query', 'axios'],
          
          // Chart and visualization libraries
          'chart-vendor': ['recharts', 'd3'],
          
          // Date and utility libraries  
          'utils-vendor': ['date-fns', 'lodash-es'],
          
          // Analytics components (lazy loaded)
          'analytics': [
            './src/components/EnhancedAnalyticsDashboard.tsx',
            './src/components/AnalyticsCharts.tsx',
            './src/components/ReportingSystem.tsx',
          ],
          
          // Quarantine components (lazy loaded)
          'quarantine': [
            './src/components/QuarantineDashboard.tsx',
            './src/components/QuarantineAnalytics.tsx',
            './src/components/QuarantinePolicyManager.tsx',
          ],
          
          // AI Analysis components (lazy loaded)
          'ai-analysis': [
            './src/components/AIAnalysisCard.tsx',
            './src/components/PredictiveAnalysis.tsx',
          ],
        },
        
        // Optimize chunk names for better caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop().replace('.tsx', '').replace('.ts', '')
            : 'chunk';
          return `js/${facadeModuleId}-[hash].js`;
        },
        
        // Optimize asset names
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `images/[name]-[hash].${ext}`;
          } else if (/css/i.test(ext)) {
            return `css/[name]-[hash].${ext}`;
          }
          return `assets/[name]-[hash].${ext}`;
        },
      },
      
      // External dependencies that shouldn't be bundled
      external: [],
    },
    
    // Minification and compression
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console logs in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    
    // Source maps for debugging
    sourcemap: process.env.NODE_ENV === 'production' ? false : true,
    
    // Optimize asset inlining
    assetsInlineLimit: 4096,
    
    // CSS code splitting
    cssCodeSplit: true,
    
    // Report bundle size
    reportCompressedSize: true,
    
    // Chunk size warnings
    chunkSizeWarningLimit: 1000,
  },

  // Development server optimizations
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    
    // Enable HTTP/2 for better performance
    https: false,
    
    // Proxy API requests
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
    
    // HMR configuration
    hmr: {
      overlay: true,
    },
  },

  // Dependency optimization
  optimizeDeps: {
    // Include dependencies that need to be pre-bundled
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'react-query',
      'axios',
      '@headlessui/react',
      '@heroicons/react/24/outline',
      '@heroicons/react/24/solid',
      'date-fns',
      'recharts',
    ],
    
    // Exclude large dependencies from pre-bundling
    exclude: [
      '@babel/runtime',
    ],
    
    // ESBuild options for faster builds
    esbuildOptions: {
      target: 'es2020',
      supported: {
        'dynamic-import': true,
      },
    },
  },

  // ESBuild configuration for faster builds
  esbuild: {
    target: 'es2020',
    // Remove React DevTools in production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    // Enable JSX optimization
    jsx: 'automatic',
  },

  // CSS processing optimizations
  css: {
    // PostCSS configuration
    postcss: {
      plugins: [
        // Add autoprefixer if needed
      ],
    },
    
    // CSS modules configuration
    modules: {
      localsConvention: 'camelCase',
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
    
    // CSS preprocessing
    preprocessorOptions: {
      scss: {
        additionalData: '@import "@/styles/variables.scss";',
      },
    },
  },

  // Preview server configuration
  preview: {
    port: 4173,
    strictPort: true,
    host: true,
  },

  // Worker configuration for Web Workers
  worker: {
    format: 'es',
    plugins: [react()],
  },

  // Performance-related environment variables
  define: {
    __DEV__: process.env.NODE_ENV === 'development',
    __PROD__: process.env.NODE_ENV === 'production',
    __VERSION__: JSON.stringify(process.env.npm_package_version),
  },

  // Experimental features for better performance
  experimental: {
    renderBuiltUrl(filename, { hostType }) {
      if (hostType === 'js') {
        return { js: `/${filename}` };
      } else {
        return { relative: true };
      }
    },
  },
});