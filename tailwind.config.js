/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{js,jsx}', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
      },
      colors: {
        ink: '#17221e',
        muted: '#78817c',
        forest: '#175b49',
        mint: '#dff1e8',
        paper: '#f5f7f3',
        line: '#e8ede8',
        tangerine: '#ed8b5a',
      },
      boxShadow: {
        card: '0 12px 35px rgba(27, 49, 39, 0.055)',
        float: '0 18px 45px rgba(27, 49, 39, 0.12)',
      },
    },
  },
  plugins: [],
};
