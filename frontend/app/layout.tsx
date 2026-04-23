import type { Metadata } from "next";
import Providers from "./providers";
import { PostHogProvider } from "./components/PostHogProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Helvara — Translation Workspace",
  description: "Translate your documents with ease",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500;1,9..144,600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        <PostHogProvider>
          <Providers>
            {children}
          </Providers>
        </PostHogProvider>
      </body>
    </html>
  );
}
