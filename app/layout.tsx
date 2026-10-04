import type { Metadata } from "next";
import type { ReactNode } from "react";
import MenuBar from "./experiments/_lib/mac/MenuBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rippled gradient",
  description: "A blended, rippling animated gradient",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-crt="off">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <div className="mac-screen">
          <MenuBar />
          <div className="mac-stage">{children}</div>
        </div>
      </body>
    </html>
  );
}
