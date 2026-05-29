import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "TuskOS — Long-Term Memory for AI Agents",
  description: "Verifiable on-chain memory powered by Walrus & MemWal.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window === 'undefined') return;

                // 1. Intercept console.error to silence MetaMask extension logs
                var originalError = console.error;
                console.error = function() {
                  var msg = Array.prototype.slice.call(arguments).map(function(arg) {
                    try {
                      return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
                    } catch (e) {
                      return String(arg);
                    }
                  }).join(' ');
                  
                  if (msg.indexOf('MetaMask') !== -1 || msg.indexOf('nkbihfbeogaeaoehlefnkodbefgpgknn') !== -1) {
                    return;
                  }
                  originalError.apply(console, arguments);
                };

                // 2. Intercept unhandledrejection
                window.addEventListener('unhandledrejection', function(event) {
                  var reason = event.reason;
                  var msg = '';
                  if (reason) {
                    msg = reason.message || String(reason);
                  }
                  if (msg.indexOf('MetaMask') !== -1 || msg.indexOf('nkbihfbeogaeaoehlefnkodbefgpgknn') !== -1) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                  }
                }, true);
              })();
            `
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
