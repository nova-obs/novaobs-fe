import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#f9f9ff',
        background: '#f8f9fa',
        'surface-lowest': '#ffffff',
        'surface-low': '#f2f3fd',
        'surface-container': '#ffffff',
        'surface-high': '#ecedf7',
        'surface-highest': '#e1e2ec',
        'on-surface': '#191b23',
        muted: '#424754',
        outline: '#c2c6d6',
        primary: '#0058be',
        'primary-soft': '#d0e1fb',
        secondary: '#008a3d',
        warning: '#b75b00',
        danger: '#ba1a1a',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        display: ['Inter', 'ui-sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '4px',
        md: '6px',
        lg: '8px',
      },
      boxShadow: {
        panel: '0 1px 3px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
} satisfies Config;
