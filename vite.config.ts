import { defineConfig } from 'vite';
import { enterDevPlugin, enterProdPlugin } from 'vite-plugin-enter-dev';

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/4U/' : '/',
  server: {
    host: '0.0.0.0',
    allowedHosts: ['terminal.local'],
  },
  plugins: [...enterProdPlugin(), ...enterDevPlugin()],
}));
