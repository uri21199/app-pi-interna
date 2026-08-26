import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { devApiPlugin } from './devApiPlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), devApiPlugin()],
  server: {
    // Permite entrar por un túnel HTTPS (cloudflared/localtunnel) para poder
    // probar Web Push desde un celular real — el celular no puede llegar a
    // localhost, y push necesita un contexto seguro (https), no alcanza con
    // la IP local en http. Solo afecta `vite dev`, no el build.
    allowedHosts: ['.trycloudflare.com', '.loca.lt'],
  },
})
