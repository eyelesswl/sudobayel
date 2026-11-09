import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Serif } from "next/font/google";
import { Background } from "@/components/Ornament";
import { I18nProvider, LangSwitch } from "@/lib/i18n";
import "./globals.css";

// Noto поддерживает кириллицу и кыргызские буквы ө, ү, ң.
const subsets: ("latin" | "cyrillic" | "cyrillic-ext")[] = ["latin", "cyrillic", "cyrillic-ext"];
const display = Noto_Serif({ subsets, weight: ["600", "800"], variable: "--font-display", display: "swap" });
const body = Noto_Sans({ subsets, weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = { title: "ОЮН", description: "Командная игра на скорость нажатия кнопки" };
export const viewport: Viewport = { themeColor: "#0e0a0a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <body>
        <I18nProvider>
          <Background />
          <div id="app-root" className="relative z-10">
            <LangSwitch />
            {children}
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
