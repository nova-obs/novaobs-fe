import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#f6f8fc',
        background: '#eef3fb',
        'surface-lowest': '#ffffff',
        'surface-low': '#edf4ff',
        'surface-container': '#ffffff',
        'surface-high': '#dce8f7',
        'surface-highest': '#c6d7ee',
        'on-surface': '#122033',
        muted: '#637083',
        outline: '#d8e2ef',
        primary: '#0d5bd7',
        'primary-soft': '#e5f0ff',
        secondary: '#00a4ff',
        warning: '#cc6b1e',
        danger: '#b4232f',
      },
      fontFamily: {
        sans: ['Geist', 'Satoshi', 'Aptos', 'ui-sans-serif', 'system-ui'],
        display: ['Geist', 'Satoshi', 'Aptos', 'ui-sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '4px',
        md: '6px',
        lg: '8px',
      },
      boxShadow: {
        panel: '0 22px 50px -34px rgba(16, 32, 55, 0.42), 0 1px 0 rgba(255, 255, 255, 0.9) inset',
      },
      backgroundImage: {
        'app-radial':
          'radial-gradient(circle at 14% 10%, rgba(13, 91, 215, 0.16), transparent 30%), radial-gradient(circle at 88% 8%, rgba(0, 164, 255, 0.14), transparent 26%), linear-gradient(135deg, #f7faff 0%, #eef4fb 46%, #f8fbff 100%)',
      },
    },
  },
  plugins: [],
} satisfies Config;
