import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "fs";
// @ts-ignore
import sri from "vite-plugin-sri";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  return {
  server: {
    host: "0.0.0.0",
    port: 3000,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(), 
    sri(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'placeholder.svg', 'pwa-icon.svg'],
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/~oauth/],
      },
      manifest: {
        name: 'ZDRX Mod Menu',
        short_name: 'ZDRX',
        description: 'Gerenciamento de licenças do mod menu.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'pwa-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          },
          {
            src: 'pwa-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      devOptions: {
        enabled: false // Disable in dev to avoid issues with Lovable preview
      }
    }),
    mode === "development" && componentTagger(),
    {
      name: 'serve-extension',
      configureServer(server: any) {
        server.middlewares.use('/ext_src', (req: any, res: any, next: any) => {
          const url = (req.url || '').split('?')[0];
          const filePath = path.join(process.cwd(), 'extension', url.replace(/^\//, ''));
          
          console.log(`[serve-extension] Request: ${req.url} -> File: ${filePath}`);
          
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes: Record<string, string> = {
              '.html': 'text/html',
              '.js': 'application/javascript; charset=utf-8',
              '.css': 'text/css; charset=utf-8',
              '.json': 'application/json; charset=utf-8',
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.gif': 'image/gif',
              '.svg': 'image/svg+xml',
            };
            res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Access-Control-Allow-Origin', '*');
            let content = fs.readFileSync(filePath);
            
            // Se for JS ou HTML, injeta as credenciais do Supabase para o preview
            if (ext === '.js' || ext === '.html') {
              let textContent = content.toString();
              const supabaseUrl = env.VITE_SUPABASE_URL || '';
              const supabaseAnonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
              
              if (supabaseUrl) {
                textContent = textContent.replace(/https:\/\/.*\.supabase\.co/g, supabaseUrl);
              }
              if (supabaseAnonKey) {
                // Tenta substituir o ANON KEY hardcoded comum
                textContent = textContent.replace(/const SUPABASE_ANON_KEY = ".*";/g, `const SUPABASE_ANON_KEY = "${supabaseAnonKey}";`);
                // Tenta outros padrões de apiKey/apikey
                textContent = textContent.replace(/apikey: ".*"/g, `apikey: "${supabaseAnonKey}"`);
                textContent = textContent.replace(/"apikey": ".*"/g, `"apikey": "${supabaseAnonKey}"`);
              }
              
              res.end(textContent);
            } else {
              res.end(content);
            }
          } else {
            console.log(`[serve-extension] Not found: ${filePath}`);
            next();
          }
        });
      }
    }
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  };
});
