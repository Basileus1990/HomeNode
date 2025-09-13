import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import devtoolsJson from 'vite-plugin-devtools-json';

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths(), devtoolsJson(),],
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    // cors: {
    //   origin: ["*", "http://localhost:3000"]
    // },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false, // if using self-signed HTTPS
        //rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  }
});
