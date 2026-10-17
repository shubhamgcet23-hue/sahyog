/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#faf8f3',
        brand: { 50: '#ecf7f3', 100: '#d3eee4', 200: '#a8dcc9', 300: '#74c3a9', 400: '#46a487', 500: '#2a8670', 600: '#1f6c5a', 700: '#1b574a', 800: '#19463d', 900: '#163a33' },
        saffron: { 50: '#fff8eb', 100: '#ffeccb', 200: '#ffd78f', 300: '#ffbf52', 400: '#f7a325', 500: '#e8870d', 600: '#c76608', 700: '#a54b0b' },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      boxShadow: { card: '0 1px 2px rgba(22,58,51,.06), 0 6px 18px -8px rgba(22,58,51,.18)' },
    },
  },
  plugins: [],
};
