/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#071126',
        accent: '#4576EF',
        offwhite: '#FAFBFF',
      },
      fontFamily: {
        bungee: ['Bungee', 'cursive'],
        manrope: ['Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
