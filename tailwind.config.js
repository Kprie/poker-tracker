/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0b0e14',
        surface: '#141922',
        surface2: '#1a212c',
        border: '#262e3b',
        muted: '#8a94a6',
        text: '#e8edf4',
        accent: '#5b9dff',
        'accent-deep': '#3f7fe0',
        profit: '#34d399',
        loss: '#f76d6d',
        ps: '#e0524a',
        gg: '#ff9d3c'
      },
      fontFamily: {
        sans: ['Geist Variable', 'Geist', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono Variable', 'Geist Mono', 'ui-monospace', 'monospace']
      },
      letterSpacing: {
        tightest: '-0.04em'
      },
      boxShadow: {
        // Tinted to the cool dark background instead of pure black.
        card: '0 1px 0 0 rgba(255,255,255,0.045) inset, 0 12px 30px -18px rgba(3,7,18,0.9)',
        pop: '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 18px 40px -16px rgba(3,7,18,0.95)',
        glow: '0 0 0 1px rgba(91,157,255,0.35), 0 8px 28px -10px rgba(91,157,255,0.35)'
      },
      zIndex: {
        nav: '10',
        overlay: '40',
        modal: '50',
        toast: '60'
      }
    }
  },
  plugins: []
}
