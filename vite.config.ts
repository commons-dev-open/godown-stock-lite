import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const devServerPort = 5173;

const rendererCspProduction =
  "default-src 'self'; " +
  "script-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob:; " +
  "font-src 'self' data:; " +
  "connect-src 'self'; " +
  "worker-src 'self' blob:; " +
  "object-src 'none'; " +
  "base-uri 'self'; " +
  "form-action 'self';";

function getRendererCspDevelopment(port: number): string {
  const connect =
    `'self' http://127.0.0.1:${port} http://localhost:${port} ws://127.0.0.1:${port} ws://localhost:${port}`;
  return (
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; " +
    "font-src 'self' data:; " +
    `connect-src ${connect}; ` +
    "worker-src 'self' blob:; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self';"
  );
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: "inject-renderer-csp-meta",
      transformIndexHtml(html, ctx) {
        const port = ctx.server?.config?.server?.port ?? devServerPort;
        const csp =
          mode === "production"
            ? rendererCspProduction
            : getRendererCspDevelopment(port);
        const tag = `<meta http-equiv="Content-Security-Policy" content="${csp}" />`;
        if (html.includes("http-equiv=\"Content-Security-Policy\"")) {
          return html;
        }
        return html.replace("<head>", `<head>\n    ${tag}`);
      },
    },
  ],
  root: "src/renderer",
  base: "./",
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/renderer"),
      shared: path.resolve(__dirname, "src/shared"),
    },
  },
  server: {
    port: devServerPort,
    fs: {
      allow: [path.resolve(__dirname)],
    },
  },
}));
