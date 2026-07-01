import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buyer Discovery — Maharath Exim",
  description: "AI-assisted international buyer discovery and qualification tool",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <body style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {children}
      </body>
    </html>
  );
}