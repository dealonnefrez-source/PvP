import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Forever | Siedziba gildii", template: "%s | Forever" },
  description: "Strona polskiej gildii WoW Forever. Twoja ekipa, wasza kolejna przygoda.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pl"
      className="dark h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
