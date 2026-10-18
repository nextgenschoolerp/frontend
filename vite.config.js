import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy: the browser talks to the Vite origin, so the backend services need no CORS setup.
// Override the targets with AUTH_SERVICE_URL / ADMISSION_SERVICE_URL when they run elsewhere.
// authservice is served under the /authservice context path; the proxy prepends it to /api/... requests
const auth = process.env.AUTH_SERVICE_URL || 'http://localhost:8082/authservice';
// admissionservice is served under the /admissionservice context path
const admission = process.env.ADMISSION_SERVICE_URL || 'http://localhost:8083/admissionservice';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/v1/admissions': { target: admission, changeOrigin: true },
      '/api': { target: auth, changeOrigin: true },
    },
  },
});
