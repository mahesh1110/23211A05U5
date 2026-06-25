import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readToken() {
  const envPath = path.resolve(__dirname, "../.env");
  if (!fs.existsSync(envPath)) return "";

  const envText = fs.readFileSync(envPath, "utf8");
  const match = envText.match(/(?:LOG_SERVICE_TOKEN|ACCESS_TOKEN)\s*=\s*"?([^"\r\n]+)"?/);
  return match ? match[1].trim() : "";
}

const token = readToken();

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      "/evaluation-service": {
        target: "http://4.224.186.213",
        changeOrigin: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    },
  },
});
