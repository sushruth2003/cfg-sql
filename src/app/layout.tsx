import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CFG SQL Demo",
  description: "GPT-5 CFG-constrained NL to ClickHouse SQL demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
