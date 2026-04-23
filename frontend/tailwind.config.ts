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
          bg:         '#FAFAF7',
          surface:    '#FFFFFF',
          sunken:     '#F4F3EE',
          border:     '#ECEAE3',
          borderSoft: '#F2F0EA',
          text:       '#121210',
          muted:      '#5A5A55',
          subtle:     '#9A9A92',
          hint:       '#BEBEB5',
          accent:     '#0D7B6E',
          accentHov:  '#0A6459',
          accentMid:  '#E6F4F2',
          accentSoft: '#F0F8F6',
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
      },
      fontFamily: {
        sans:    ['var(--font-inter-tight)', 'Inter Tight', 'system-ui', 'sans-serif'],
        display: ['var(--font-fraunces)', 'Fraunces', 'Georgia', 'serif'],
        mono:    ['var(--font-jetbrains)', 'JetBrains Mono', 'monospace'],
      },
      letterSpacing: {
        display: '-0.03em',
        heading: '-0.02em',
        body:    '-0.005em',
      },
      borderRadius: {
        sm:      '6px',
        DEFAULT: '10px',
        lg:      '14px',
        xl:      '18px',
        '2xl':   '22px',
        '3xl':   '28px',
        full:    '9999px',
      },
      boxShadow: {
        card:   '0 1px 0 rgba(17,17,14,0.04), 0 1px 2px rgba(17,17,14,0.03)',
        raised: '0 2px 6px -1px rgba(17,17,14,0.05), 0 8px 24px -8px rgba(17,17,14,0.08)',
        ring:   '0 0 0 1px rgba(17,17,14,0.05), 0 1px 2px rgba(17,17,14,0.04)',
        // Keep some Tailwind defaults for existing pages
        sm: '0 1px 2px 0 rgba(17,17,14,0.05)',
        md: '0 4px 6px -1px rgba(17,17,14,0.06)',
        lg: '0 10px 15px -3px rgba(17,17,14,0.08)',
        xl: '0 20px 25px -5px rgba(17,17,14,0.10)',
      },
      keyframes: {
        fadein: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        scalein: {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        slideup: {
          from: { opacity: '0', transform: 'translate(-50%, 12px)' },
          to:   { opacity: '1', transform: 'translate(-50%, 0)' },
        },
        slidedown: {
          from: { opacity: '0', maxHeight: '0' },
          to:   { opacity: '1', maxHeight: '2000px' },
        },
      },
      animation: {
        fadein:    'fadein 150ms ease-out',
        scalein:   'scalein 180ms cubic-bezier(0.22,1,0.36,1)',
        slideup:   'slideup 300ms ease-out',
        slidedown: 'slidedown 300ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
