/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#611f69', light: '#7d3c86', dark: '#4a154b' },
        success: '#0f7840',
        danger: '#da2e38',
        warning: '#ecb22e',
        info: '#1264a3',
        slack: {
          bg: '#f8f8f8',
          hover: '#f0f0f0',
          active: '#ebebeb',
          input: '#f2f2f2',
          'msg-hover': '#f2f8fc',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['SF Mono', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
