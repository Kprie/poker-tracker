/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#07090d',
        surface: '#10141c',
        surface2: '#161b25',
        border: '#222936',
        muted: '#8b95a8',
        text: '#eef2f8',
        accent: '#6aa6ff',
        'accent-deep': '#4d8af0',
        ink: '#05101f',
        profit: '#3ddc97',
        loss: '#ff6b6b',
        ps: '#e0524a',
        gg: '#ffa23c'
      },
      fontFamily: {
        sans: ['Geist Variable', 'Geist', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono Variable', 'Geist Mono', 'ui-monospace', 'monospace']
      },
      letterSpacing: {
        tightest: '-0.045em',
        eyebrow: '0.22em'
      },
      borderRadius: {
        bezel: '1.75rem',
        core: 'calc(1.75rem - 0.375rem)'
      },
      transitionTimingFunction: {
        fluid: 'cubic-bezier(0.32, 0.72, 0, 1)'
      },
      boxShadow: {
        ambient: '0 24px 60px -28px rgba(0,0,0,0.85)',
        glow: '0 0 0 1px rgba(106,166,255,0.30), 0 10px 40px -12px rgba(106,166,255,0.35)',
        'inset-hi': 'inset 0 1px 0 0 rgba(255,255,255,0.08)'
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
