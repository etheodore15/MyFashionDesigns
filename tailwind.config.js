/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#faf7f2',
        ink: '#2b2b2b',
        accent: '#e86fa4',
        accentSoft: '#f7cfe0'
      },
      fontFamily: {
        // System fonts only — Rule 4 forbids runtime font fetches.
        round: ['"Comic Sans MS"', '"Segoe UI"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
