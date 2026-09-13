/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#FAF8F5',
          card: '#FFFFFF',
          subtle: '#F3EFEA',
        },
        primary: {
          50: '#F5F7FF',
          100: '#EBF0FE',
          500: '#4F46E5',
          600: '#4338CA',
          700: '#3730A3',
        },
        // Soft pastel palette directly inspired by financial capsule UI
        pastel: {
          yellow: '#E6DE98',
          yellowLight: '#FAF5CC',
          blue: '#B5C0EA',
          blueLight: '#E2E7FC',
          peach: '#F4BBA6',
          peachLight: '#FDE4DC',
          pink: '#E89EB7',
          pinkLight: '#FADAE4',
          mint: '#A4D9C8',
          mintLight: '#DCF4ED',
          purple: '#CAB7EC',
          purpleLight: '#EDE6FB',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
        'pill': '9999px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.02)',
        card: '0 4px 20px -2px rgba(18, 24, 40, 0.05)',
        elevated: '0 12px 32px -4px rgba(18, 24, 40, 0.08)',
      },
    },
  },
  plugins: [],
};
