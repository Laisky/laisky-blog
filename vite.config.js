import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';


// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export default defineConfig({
    plugins: [react()],
    define: { global: "window" },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '~bootstrap': path.resolve(__dirname, 'node_modules/bootstrap'),
        },
    },
    css: {
        // preprocessorOptions: {
        //     scss: {
        //         additionalData: `@import "src/styles/variables.scss";`
        //     },
        // },
    },
    server: {
        port: 3000,
    },
});
