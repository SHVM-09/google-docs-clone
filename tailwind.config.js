import containerQueries from '@tailwindcss/container-queries';
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],

  theme: {
    extend: {
      fontFamily: {
        merriweather: ['Merriweather', 'serif'],
        courier: ['"Courier New"', 'monospace'],
        impact: ['Impact', 'sans-serif'],
        amatic: ['"Amatic SC"', 'cursive'],
        georgia: ['Georgia', 'serif'],
      },
    },
  },

  plugins: [typography, forms, containerQueries],
};
