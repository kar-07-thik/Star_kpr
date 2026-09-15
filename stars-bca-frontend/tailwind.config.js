/** @type {import('tailwindcss').Config} */
/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17263F',
        paper: '#F4F6FB',
        card: '#FFFFFF',
        slate: {
          50: '#F7F9FC',
          100: '#EEF2F7',
          200: '#DFE5EF',
          300: '#C6CFDE',
          400: '#9AA8BE',
          500: '#75849C',
          600: '#5A6A83',
          700: '#46546B',
          800: '#333F52',
          900: '#232C3B',
        },
        brand: {
          50: '#EEF2FA',
          100: '#DCE4F5',
          200: '#B9C8E9',
          300: '#92A8DA',
          400: '#5E7FBF',
          500: '#2C4D90',
          600: '#26407A',
          700: '#1E3363',
          800: '#162649',
          900: '#0F1B34',
        },
        leaf: {
          100: '#D9EEE3',
          200: '#AFDBBF',
          300: '#7BC497',
          400: '#47A86E',
          500: '#208D49',
          600: '#1A733D',
          700: '#155A30',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Public Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        modal: '0 24px 60px -20px rgba(23,38,63,0.35), 0 8px 20px -12px rgba(23,38,63,0.22)',
        soft: '0 1px 2px rgba(23,38,63,0.05)',
      },
    },
  },
  plugins: [],
}