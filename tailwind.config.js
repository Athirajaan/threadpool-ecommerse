/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./views/**/*.{ejs,js}"],
  theme: {
    extend: {
      fontFamily: {
        playfair: ["Playfair Display", "serif"],
        "source-sans": ["Source Sans Pro", "sans-serif"],
        merriweather: ["Merriweather", "serif"],
        "open-sans": ["Open Sans", "sans-serif"],
        lora: ["Lora", "serif"],
        montserrat: ["Montserrat", "sans-serif"],
      },
    },
  },
  plugins: [],
};
