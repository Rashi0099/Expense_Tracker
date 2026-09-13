import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      'react-native': path.resolve(__dirname, 'src/__mocks__/react-native.ts'),
      '@react-native-async-storage/async-storage': path.resolve(
        __dirname,
        'src/__mocks__/async-storage.ts'
      ),
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
