/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#172033',
        navy: '#183153',
        gold: '#c9a45c',
        mist: '#f5f7fb',
      },
      boxShadow: { card: '0 12px 35px rgba(23, 32, 51, .08)' },
    },
  },
  plugins: [],
};
