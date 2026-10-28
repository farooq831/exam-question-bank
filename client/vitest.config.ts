import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Component tests: React components rendered in a simulated browser (jsdom).
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', include: ['tests/**/*.test.{ts,tsx}'], setupFiles: ['tests/setup.ts'], restoreMocks: true },
});
