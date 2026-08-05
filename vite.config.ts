/// <reference types="vitest/config" />
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // Pure-function tests only for now (colour math, layout helpers, the
    // script-level suites migrated off node:test). Add `environment: 'jsdom'`
    // alongside a DOM testing library when component tests arrive.
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/tests/**/*.test.mjs'],
  },
})
