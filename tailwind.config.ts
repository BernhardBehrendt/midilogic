import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      gridTemplateColumns: {
        '16': 'repeat(16, minmax(0, 1fr))',
      },
      animation: {
        'pulse-glow': 'pulse-glow 0.3s ease-in-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%': {
            boxShadow: '0 0 0 0 rgba(59, 130, 246, 0.7)'
          },
          '70%': {
            boxShadow: '0 0 0 10px rgba(59, 130, 246, 0)'
          },
          '100%': {
            boxShadow: '0 0 0 0 rgba(59, 130, 246, 0)'
          },
        },
      },
    },
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      "light",
      "dark",
      "cupcake",
      "bumblebee",
      "emerald",
      "corporate",
      "synthwave",
      "retro",
      "cyberpunk",
      "valentine",
      "halloween",
      "garden",
      "forest",
      "aqua",
      "lofi",
      "pastel",
      "fantasy",
      "wireframe",
      "black",
      "luxury",
      "dracula",
      "cmyk",
      "autumn",
      "business",
      "acid",
      "lemonade",
      "night",
      "coffee",
      "winter",
    ],
    base: true,
    styled: true,
    utils: true,
  },
}

export default config
