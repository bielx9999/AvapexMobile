/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        avapex: {
          yellow: '#FACC15',
          black: '#1F1C1C',
          ink: '#111111',
          paper: '#F7F7F7',
        },
      },
    },
  },
  plugins: [],
};
