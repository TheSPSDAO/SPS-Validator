/// <reference types='vitest' />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

const BASE_URL = process.env.BASE_URL || '/';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, __dirname, '');
    const proxyTarget = env.VALIDATOR_API_PROXY_TARGET || process.env.VALIDATOR_API_PROXY_TARGET;

    return {
        base: BASE_URL,
        root: __dirname,
        cacheDir: '../../node_modules/.vite/apps/sps-validator-ui',
        server: {
            port: 4200,
            host: 'localhost',
            proxy: proxyTarget
                ? {
                      '/api': {
                          target: proxyTarget,
                          changeOrigin: true,
                          secure: false,
                          rewrite: (path) => path.replace(/^\/api/, ''),
                      },
                  }
                : undefined,
        },
        preview: {
            port: 4300,
            host: 'localhost',
        },
        plugins: [react(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
        envPrefix: ['VITE_', 'VALIDATOR_'],
        build: {
            outDir: '../../dist/apps/sps-validator-ui',
            emptyOutDir: true,
            reportCompressedSize: true,
            commonjsOptions: {
                transformMixedEsModules: true,
            },
        },
        test: {
            watch: false,
            globals: true,
            environment: 'jsdom',
            include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
            reporters: ['default'],
            coverage: {
                reportsDirectory: '../../coverage/apps/sps-validator-ui',
                provider: 'v8',
            },
        },
    };
});
