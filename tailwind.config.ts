import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#f7f8f4',
        background: '#f2f5ef',
        'surface-lowest': '#fffefa',
        'surface-low': '#eef4ee',
        'surface-container': '#fffffb',
        'surface-high': '#e1e9e2',
        'surface-highest': '#d4ddd6',
        'on-surface': '#1d2426',
        muted: '#56605d',
        outline: '#d9e1da',
        primary: '#1f7a76',
        'primary-soft': '#dcefeb',
        secondary: '#587f43',
        warning: '#a9671f',
        danger: '#b94138',
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
        panel: '0 20px 45px -28px rgba(29, 36, 38, 0.35), 0 1px 0 rgba(255, 255, 255, 0.78) inset',
      },
      backgroundImage: {
        'app-radial':
          'radial-gradient(circle at 16% 12%, rgba(31, 122, 118, 0.14), transparent 28%), radial-gradient(circle at 88% 8%, rgba(88, 127, 67, 0.11), transparent 24%), linear-gradient(135deg, #f8faf5 0%, #eff5ef 48%, #f7f8f4 100%)',
      },
    },
  },
  plugins: [],
} satisfies Config;
