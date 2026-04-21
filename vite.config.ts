import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // 1. 新增导入

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss() // 2. 注入插件
  ],
  base: './', // 使用相对路径
})
