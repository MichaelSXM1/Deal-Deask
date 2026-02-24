import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        cedar: {
          50: "#f2fbf9",
          100: "#d4f3ec",
          500: "#15735f",
          700: "#0f5344",
          900: "#0a3128"
        }
      }
    }
  },
  plugins: []
};

export default config;
