import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Space Grotesk para números/headings grandes — tiene ese carácter un
// poco técnico y geométrico que encaja con "estadísticas de código" sin
// caer en el monospace-para-todo genérico. Manrope para el cuerpo: limpia
// y neutra a tamaños pequeños, donde Space Grotesk se siente pesada.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"]
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"]
});

export const metadata: Metadata = {
  title: "GitHub Wrapped",
  description: "Descubre cómo programaste este año."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${spaceGrotesk.variable} ${manrope.variable}`}>
      <body className="bg-wrapped-bg text-white min-h-screen antialiased font-body">
        {children}
      </body>
    </html>
  );
}
