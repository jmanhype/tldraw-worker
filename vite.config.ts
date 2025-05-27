import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import chalk from "chalk";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    cloudflare(),
    react(),
    {
      name: "requestLogger",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const timeString = new Date().toLocaleTimeString();
          console.log(
            `[${chalk.blue(timeString)}] ${chalk.green(
              req.method
            )} ${chalk.yellow(req.url)} ${res.statusCode}`
          );
          next();
        });
      },
    },
  ],
});
