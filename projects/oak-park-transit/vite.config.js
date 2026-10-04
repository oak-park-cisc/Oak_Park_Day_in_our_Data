import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base matches the GitHub Pages path: https://captainchemist.github.io/oak-park-transit-tracker/
export default defineConfig({
  plugins: [react()],
  base: '/oak-park-transit-tracker/',
})
