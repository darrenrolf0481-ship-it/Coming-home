import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'Spectral Nexus AI',
        short_name: 'SpectralNexus',
        description: 'Obsidian Protocol AI Interface',
        theme_color: '#050208',
        background_color: '#050208',
        display: 'standalone',
        icons: [
          {
            src: 'https://api.iconify.design/lucide:command.svg?color=%2300FFFF',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'https://api.iconify.design/lucide:command.svg?color=%2300FFFF',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    }
  }
});
