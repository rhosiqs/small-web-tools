import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { parseIpInput } from './src/lib/ipValidation';
import { lookupIpGeolocation } from './src/lib/ipLookupProviders.js';
import { resolveRepositoryVersion } from './scripts/resolve-version.mjs';

const version = resolveRepositoryVersion();

const showChannelAlert = version.includes('alpha') || version.includes('beta');
const appChannel = version.includes('alpha') ? 'alpha' : version.includes('beta') ? 'beta' : '';

// Server-side geo lookup — shared provider policy with Node-specific logging.
async function geoLookup(ip) {
  return lookupIpGeolocation(ip, {
    headers: { 'User-Agent': 'curl/7.88.1', Accept: 'application/json' },
    onProviderError: (_provider, error) => {
      console.warn('[ip-lookup]', error.message);
    },
  });
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __SHOW_CHANNEL_ALERT__: showChannelAlert,
    __APP_CHANNEL__: JSON.stringify(appChannel),
  },
  server: {
    host: '127.0.0.1',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/i18n/locales/') || id.includes('\\src\\i18n\\locales\\')) {
            return 'locales';
          }
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('exifreader') || id.includes('jszip')) {
              return 'vendor-meta';
            }
            if (id.includes('ffmpeg')) {
              return 'vendor-ffmpeg';
            }
          }
        }
      }
    }
  },
  plugins: [
    react(),
    {
      name: 'ip-lookup-api',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/api/iplookup')) return next();

          const urlObj = new URL(req.url, 'http://localhost');
          const parsedIp = parseIpInput(urlObj.searchParams.get('ip') || '');

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');

          if (parsedIp.error) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: parsedIp.error }));
            return;
          }

          try {
            const data = await geoLookup(parsedIp.value);
            res.statusCode = 200;
            res.end(JSON.stringify({ ok: true, data }));
          } catch (e) {
            console.error('[ip-lookup] all providers failed:', e.message);
            res.statusCode = 502;
            res.end(JSON.stringify({ ok: false, error: e.message }));
          }
        });
      }
    },
  ],
});
