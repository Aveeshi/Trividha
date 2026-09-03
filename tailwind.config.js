/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/views/**/*.ejs",
    "./src/public/js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        // Trividha canvas
        canvas: '#F5F7FA',
        surface: '#FFFFFF',
        // Deep navy text
        navy: {
          DEFAULT: '#172747',
          900: '#0F1C33',
          800: '#172747',
          700: '#22355C',
          600: '#334B79',
        },
        // Muted blue-gray secondary text
        slateink: {
          DEFAULT: '#64748B',
          600: '#64748B',
          500: '#7C8AA0',
          400: '#94A3B8',
        },
        // Healthcare blue
        brand: {
          50: '#EEF5FF',
          100: '#DCE9FC',
          200: '#BBD3F7',
          300: '#8DB6F0',
          400: '#5290E2',
          500: '#1E63C6',
          600: '#1557B0',
          700: '#124A96',
          800: '#0F3D7B',
        },
        // Trividha red — medical alert only
        alert: {
          50: '#FDECEC',
          100: '#FAD9D9',
          200: '#F3B4B4',
          500: '#D93A3A',
          600: '#C62828',
          700: '#A61F1F',
        },
        // Green — available / completed / verified
        ok: {
          50: '#E9F7EF',
          100: '#D1EEDD',
          500: '#1F9254',
          600: '#157347',
          700: '#0F5A37',
        },
        // AYUSH — muted green + soft purple accent
        ayush: {
          50: '#EDF6F1',
          100: '#D8EBE0',
          500: '#2F7A5A',
          600: '#256349',
        },
        veda: {
          50: '#F3F1FD',
          100: '#E5E1FA',
          500: '#6D5BD0',
          600: '#5A48B8',
        },
        hairline: '#E6EBF2',
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '22px',
        panel: '18px',
        soft: '14px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(23,39,71,0.04), 0 10px 28px -18px rgba(23,39,71,0.18)',
        lift: '0 2px 4px rgba(23,39,71,0.05), 0 18px 40px -22px rgba(23,39,71,0.28)',
        pop: '0 24px 60px -24px rgba(23,39,71,0.32)',
        focus: '0 0 0 3px rgba(30,99,198,0.22)',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'rise': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-left': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out both',
        rise: 'rise 220ms cubic-bezier(0.22,1,0.36,1) both',
        'slide-left': 'slide-left 220ms cubic-bezier(0.22,1,0.36,1) both',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
