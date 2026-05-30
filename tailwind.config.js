/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral near-black (no blue cast).
        bg: '#0a0a0b',
        surface: '#141415',
        surface2: '#1b1b1d',
        border: '#28282c',
        muted: '#9a9aa1',
        text: '#ededee',
        // Green brand accent (matches the chip/spade logo).
        accent: '#34d399',
        'accent-deep': '#27ae7f',
        ink: '#04130c',
        profit: '#3ddc97',
        loss: '#f0686d',
        ps: '#e0524a',
        gg: '#f3a13c'
      },
      fontFamily: {
        sans: ['Geist Variable', 'Geist', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono Variable', 'Geist Mono', 'ui-monospace', 'monospace']
      },
      letterSpacing: {
        tightest: '-0.045em',
        eyebrow: '0.18em'
      },
      transitionTimingFunction: {
        fluid: 'cubic-bezier(0.22, 1, 0.36, 1)'
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -16px rgba(0,0,0,0.7)',
        glow: '0 0 0 1px rgba(52,211,153,0.25)'
      },
      zIndex: {
        nav: '30',
        overlay: '40',
        modal: '50',
        grain: '60'
      }
    }
  },
  plugins: []
}
