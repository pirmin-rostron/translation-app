import type { Metadata } from "next";
import Nav from "./components/Nav";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Document Translation",
  description: "Translate your documents with ease",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <Nav />
          {children}
        </Providers>
      </body>
    </html>
  );
}
