/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./App.jsx", "./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Brand Colors (Vibrant & Modern)
        primary: {
          DEFAULT: '#5B718A',
          50: '#E8EDF3',
          100: '#D1DBE7',
          200: '#A3B7CF',
          300: '#7593B7',
          400: '#68849E',
          500: '#5B718A',
          600: '#4A5D70',
          700: '#394656',
          800: '#282E3B',
          900: '#171721',
        },
        secondary: {
          DEFAULT: '#8DAAA5',
          50: '#E8F2F1',
          100: '#D1E5E3',
          200: '#A3CBC7',
          300: '#75B1AB',
          400: '#8DAAA5',
          500: '#8DAAA5',
          600: '#6D8A85',
          700: '#526965',
          800: '#374845',
          900: '#1C2725',
        },
        accent: {
          DEFAULT: '#F7BC20',
          50: '#FFF6E0',
          100: '#FFEDC1',
          200: '#FFDB83',
          300: '#FFC945',
          400: '#FFC107',
          500: '#F7BC20',
          600: '#E0A908',
          700: '#B88A07',
          800: '#906B05',
          900: '#684C04',
        },
      },
      fontFamily: {
        sans: ["Inter_400Regular"],
        inter: ["Inter_400Regular"],
        "inter-medium": ["Inter_500Medium"],
        "inter-semibold": ["Inter_600SemiBold"],
        "inter-bold": ["Inter_700Bold"],
      },
    },
  },
  plugins: [],
};