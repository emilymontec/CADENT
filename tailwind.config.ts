import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        wrapped: {
          bg: "#0d1117",
          card: "#161b22",
          border: "#21262d",
          accent: "#58a6ff",
          amber: "#e3b341"
        },
        // Escala de intensidad para el heatmap de actividad — deliberadamente
        // la misma convención visual del contribution graph de GitHub, ya que
        // es exactamente el vocabulario visual que el usuario ya reconoce
        // para "actividad de commits por día". No tiene sentido inventar una
        // paleta distinta para el mismo concepto.
        heat: {
          0: "#161b22",
          1: "#0e4429",
          2: "#006d32",
          3: "#26a641",
          4: "#39d353"
        }
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"]
      }
    }
  },
  plugins: []
};

export default config;
