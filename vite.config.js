import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';


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
