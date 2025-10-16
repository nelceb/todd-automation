/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Subtle color palette inspired by earthy tones
        redwood: {
          50: '#fdf2f2',
          100: '#fce7e7',
          200: '#f8d1d2',
          300: '#f1a8aa',
          400: '#e87578',
          500: '#A63D40', // Main redwood
          600: '#8a3235',
          700: '#6e282a',
          800: '#5a2123',
          900: '#4a1c1e',
        },
        earth: {
          50: '#fefbf5',
          100: '#fdf6e8',
          200: '#f9ecc5',
          300: '#f4dd9a',
          400: '#eec86f',
          500: '#E9B872', // Main earth yellow
          600: '#d4a565',
          700: '#b89058',
          800: '#9c7b4b',
          900: '#80663e',
        },
        asparagus: {
          50: '#f6f8f2',
          100: '#eef2e6',
          200: '#dde5cc',
          300: '#c5d3a8',
          400: '#a8c080',
          500: '#90A959', // Main asparagus
          600: '#7d954a',
          700: '#6a813b',
          800: '#576d2f',
          900: '#475925',
        },
        airforce: {
          50: '#f0f4f7',
          100: '#e1e9ef',
          200: '#c3d3df',
          300: '#a5bdcf',
          400: '#87a7bf',
          500: '#6494AA', // Main air force blue
          600: '#5a8399',
          700: '#507288',
          800: '#466177',
          900: '#3c5066',
        },
        // Keep primary for compatibility
        primary: {
          50: '#f0f4f7',
          100: '#e1e9ef',
          200: '#c3d3df',
          300: '#a5bdcf',
          400: '#87a7bf',
          500: '#6494AA',
          600: '#5a8399',
          700: '#507288',
          800: '#466177',
          900: '#3c5066',
        },
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}


