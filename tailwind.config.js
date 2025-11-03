module.exports = {
  content: [
    "./pages/*.{html,js}",
    "./index.html",
    "./js/*.js",
    "./components/*.html"
  ],
  theme: {
    extend: {
      colors: {
        // Primary Colors - Burgundy
        primary: {
          DEFAULT: "#8B2635", // burgundy-600
          50: "#FDF2F4", // burgundy-50
          100: "#FCE7EA", // burgundy-100
          200: "#F9CFD6", // burgundy-200
          300: "#F5A8B7", // burgundy-300
          400: "#EF7A8F", // burgundy-400
          500: "#E54B67", // burgundy-500
          600: "#8B2635", // burgundy-600
          700: "#6B1E2A", // burgundy-700
          800: "#4B161E", // burgundy-800
          900: "#2B0E13", // burgundy-900
        },
        // Secondary Colors - Gold
        secondary: {
          DEFAULT: "#D4AF37", // gold-500
          50: "#FEFCF5", // gold-50
          100: "#FDF9EB", // gold-100
          200: "#FBF3D7", // gold-200
          300: "#F7E7AF", // gold-300
          400: "#F3DB87", // gold-400
          500: "#D4AF37", // gold-500
          600: "#B8962F", // gold-600
          700: "#9C7D27", // gold-700
          800: "#80641F", // gold-800
          900: "#644B17", // gold-900
        },
        // Accent Colors - Orange
        accent: {
          DEFAULT: "#E67E22", // orange-500
          50: "#FEF7F2", // orange-50
          100: "#FDEEE5", // orange-100
          200: "#FBDDCB", // orange-200
          300: "#F7BB97", // orange-300
          400: "#F39963", // orange-400
          500: "#E67E22", // orange-500
          600: "#C7691D", // orange-600
          700: "#A85418", // orange-700
          800: "#893F13", // orange-800
          900: "#6A2A0E", // orange-900
        },
        // Background Colors
        background: "#FEFEFE", // neutral-50
        surface: {
          DEFAULT: "#F8F6F3", // warm-50
          100: "#F5F3F0", // warm-100
          200: "#F0EDE8", // warm-200
          300: "#E8E5E0", // warm-300
        },
        // Text Colors
        text: {
          primary: "#2C2C2C", // gray-800
          secondary: "#6B6B6B", // gray-500
          tertiary: "#9CA3AF", // gray-400
        },
        // Status Colors
        success: {
          DEFAULT: "#27AE60", // green-500
          50: "#F0FDF4", // green-50
          100: "#DCFCE7", // green-100
          500: "#27AE60", // green-500
          600: "#22C55E", // green-600
        },
        warning: {
          DEFAULT: "#F39C12", // amber-500
          50: "#FFFBEB", // amber-50
          100: "#FEF3C7", // amber-100
          500: "#F39C12", // amber-500
          600: "#D97706", // amber-600
        },
        error: {
          DEFAULT: "#E74C3C", // red-500
          50: "#FEF2F2", // red-50
          100: "#FEE2E2", // red-100
          500: "#E74C3C", // red-500
          600: "#DC2626", // red-600
        },
      },
      fontFamily: {
        playfair: ['Playfair Display', 'serif'],
        inter: ['Inter', 'sans-serif'],
        script: ['Dancing Script', 'cursive'],
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1.2' }],
        '6xl': ['3.75rem', { lineHeight: '1.1' }],
        '7xl': ['4.5rem', { lineHeight: '1.1' }],
        '8xl': ['6rem', { lineHeight: '1' }],
        '9xl': ['8rem', { lineHeight: '1' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
        '144': '36rem',
      },
      aspectRatio: {
        'golden': '1.618',
        'video-wide': '21 / 9',
      },
      boxShadow: {
        'subtle': '0 4px 20px rgba(0, 0, 0, 0.08)',
        'prominent': '0 8px 30px rgba(139, 38, 53, 0.15)',
        'card': '0 2px 12px rgba(0, 0, 0, 0.06)',
        'glow-primary': '0 0 20px rgba(139, 38, 53, 0.3)',
        'glow-secondary': '0 0 20px rgba(212, 175, 55, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'slide-in-right': 'slideInRight 0.5s ease-out forwards',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
        'bounce-gentle': 'bounce 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.19, 1, 0.22, 1)',
        'in-expo': 'cubic-bezier(0.95, 0.05, 0.795, 0.035)',
      },
      backdropBlur: {
        xs: '2px',
      },
      screens: {
        'xs': '475px',
        '3xl': '1600px',
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms')({
      strategy: 'class',
    }),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
  ],
}