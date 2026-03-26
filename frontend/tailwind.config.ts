import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg:        '#F5F2EC',
          surface:   '#FFFFFF',
          border:    '#E5E0D8',
          text:      '#1A110A',
          muted:     '#6B6158',
          subtle:    '#9E9189',
          accent:    '#0D7B6E',
          accentHov: '#0A6459',
          accentMid: '#E6F4F2',
        },
        status: {
          success:   '#15803D',
          successBg: '#F0FDF4',
          warning:   '#B45309',
          warningBg: '#FFFBEB',
          error:     '#B91C1C',
          errorBg:   '#FEF2F2',
          info:      '#1D4ED8',
          infoBg:    '#EFF6FF',
        },
        dash: {
          bg:         '#fcf9f0',
          surface:    '#ffffff',
          forest:     '#082012',
          teal:       '#4a8a82',
          'teal-muted': '#8bb8b2',
          'text-dark':  '#1c2b1c',
          'text-mid':   '#4a5a4a',
          'text-muted': '#8a9a8a',
          border:     '#e8e5de',
          'border-light': '#f1eee5',
        },
      },
      fontFamily: {
        sans:       ['Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
        display:    ['Playfair Display', 'Georgia', 'serif'],
        newsreader: ["'Newsreader'", 'Georgia', 'serif'],
        inter:      ['Inter', 'sans-serif'],
      },
      borderRadius: {
        sm:      '4px',
        DEFAULT: '8px',
        lg:      '12px',
        xl:      '16px',
        '2xl':   '20px',
        full:    '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(26, 17, 10, 0.05)',
        md: '0 4px 6px -1px rgba(26, 17, 10, 0.08)',
        lg: '0 10px 15px -3px rgba(26, 17, 10, 0.10)',
        xl: '0 20px 25px -5px rgba(26, 17, 10, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
