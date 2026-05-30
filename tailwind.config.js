/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0d1117',
        surface: '#161b22',
        surface2: '#1c2330',
        border: '#2a313c',
        muted: '#8b95a5',
        text: '#e6edf3',
        accent: '#3b82f6',
        profit: '#22c55e',
        loss: '#ef4444',
        ps: '#d11f1f',
        gg: '#ff7a00'
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
