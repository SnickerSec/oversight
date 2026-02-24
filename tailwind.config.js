/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card-bg)',
          foreground: 'var(--foreground)',
        },
        popover: {
          DEFAULT: 'var(--card-bg)',
          foreground: 'var(--foreground)',
        },
        primary: {
          DEFAULT: 'var(--accent)',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: 'var(--card-bg)',
          foreground: 'var(--foreground)',
        },
        muted: {
          DEFAULT: 'var(--card-bg)',
          foreground: 'var(--text-muted)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: '#ffffff',
        },
        destructive: {
          DEFAULT: 'var(--accent-red)',
          foreground: '#ffffff',
        },
        border: 'var(--card-border)',
        input: 'var(--card-border)',
        ring: 'var(--accent)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
