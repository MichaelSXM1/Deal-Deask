import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cedar Deal Dashboard",
  description: "Ultra-lean real estate wholesaling deal tracker"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
