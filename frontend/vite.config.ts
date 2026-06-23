import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'plugin-inspect-react-code'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  define: {
    'import.meta.env.VITE_USE_MOCK': JSON.stringify('true'),
  },
  plugins: [inspectAttr(), react()],
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // vendor libs
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) return 'vendor';
          if (id.includes('node_modules/recharts')) return 'recharts';
          if (id.includes('node_modules/framer-motion')) return 'motion';
          if (id.includes('node_modules/lucide-react')) return 'icons';
          if (id.includes('node_modules/@radix-ui')) return 'radix';
          // Heavy pages -> own chunks (keeps entry under ~250KB for Cloudflared)
          if (id.includes('src/pages/CobReval')) return 'cob-reval';
          if (id.includes('src/pages/ReitsDashboard')) return 'reits-dashboard';
          if (id.includes('src/pages/MaterialAnalysis')) return 'material-analysis';
          if (id.includes('src/pages/MultiAgentChat')) return 'multi-agent-chat';
          if (id.includes('src/pages/Committee')) return 'committee';
          if (id.includes('src/pages/Home')) return 'home';
          // Shadcn UI components
          if (id.includes('src/components/ui/')) return 'shadcn-ui';
        },
      },
    },
  },
});
