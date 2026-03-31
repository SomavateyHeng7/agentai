/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0d1b2a',
        shell: '#f6f8f7',
        accent: '#d97706',
        moss: '#1f6f50'
      }
    }
  },
  plugins: []
};
