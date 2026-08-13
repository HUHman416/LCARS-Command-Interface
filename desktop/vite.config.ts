import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({root:__dirname,publicDir:path.resolve(__dirname,"../public"),plugins:[react()],base:"./",build:{outDir:path.resolve(__dirname,"../desktop-dist"),emptyOutDir:true}});
