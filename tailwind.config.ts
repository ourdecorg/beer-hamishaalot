import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Warm sandy tones — background & surface
        sand: {
          50: '#fdfaf5',
          100: '#f9f3e7',
          200: '#f2e5cd',
          300: '#e7d1a8',
          400: '#d9b87d',
          500: '#c99b55',
          600: '#ad7d38',
          700: '#8d622c',
          800: '#714e26',
          900: '#5c4020',
        },
        // Deep water / well tones — primary
        well: {
          50: '#edf5f8',
          100: '#d3e8f0',
          200: '#a9d2e2',
          300: '#73b4ce',
          400: '#4094b5',
          500: '#2a7899',
          600: '#1c5f7a',
          700: '#154963',
          800: '#0f3850',
          900: '#0b2d41',
        },
        // Warm amber — accent / action
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },
      fontFamily: {
        sans: ['var(--font-heebo)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-frank-ruhl)', 'Georgia', 'serif'],
      },
      animation: {
        'ripple': 'ripple 2s ease-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        ripple: {
          '0%': { transform: 'scale(0.8)', opacity: '1' },
          '100%': { transform: 'scale(2)', opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
