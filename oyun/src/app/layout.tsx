import type { Metadata, Viewport } from "next";
import { Background } from "@/components/Ornament";
import { I18nProvider, LangSwitch } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "ОЮН",
  description: "Командная игра на скорость нажатия кнопки",
};

export const viewport: Viewport = {
  themeColor: "#0e0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
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
