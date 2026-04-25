/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        sidebar: {
          bg: '#0f172a',
          hover: '#1e293b',
          active: '#2563eb',
          text: '#94a3b8',
          'text-active': '#ffffff',
        },
        surface: '#F4F6F9',
        'card-border': '#E5E9F0',
        // Status design system
        status: {
          draft: { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF' },
          pending: { bg: '#FFF7ED', text: '#C2410C', dot: '#F97316' },
          approved: { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' },
          transit: { bg: '#F5F3FF', text: '#7C3AED', dot: '#8B5CF6' },
          completed: { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E' },
          rejected: { bg: '#FEF2F2', text: '#B91C1C', dot: '#EF4444' },
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'card': '10px',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
        'card-hover': '0 4px 12px 0 rgba(0, 0, 0, 0.06), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
        'dropdown': '0 10px 40px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.25s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideIn: { '0%': { transform: 'translateX(-8px)', opacity: 0 }, '100%': { transform: 'translateX(0)', opacity: 1 } },
        slideUp: { '0%': { transform: 'translateY(8px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        'pulse-dot': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
      },
    },
  },
  plugins: [],
}
