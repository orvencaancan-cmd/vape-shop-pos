import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RegisterServiceWorker } from "./register-sw";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VapeStock — POS & Inventory for Vape Shops",
  description:
    "Point of sale and inventory management built for vape shops — track e-juice variants, ring up sales, and see what's low on stock, from your phone or your PC.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VapeStock",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1216" },
  ],
};

// Sets the `dark` class before first paint (reading a manual preference from
// localStorage, falling back to system preference only as the initial
// default) so there's no flash of the wrong theme and no hydration mismatch.
const noFlashThemeScript = `(function(){try{var t=localStorage.getItem('theme');var dark=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(dark)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-canvas text-ink">
        <script dangerouslySetInnerHTML={{ __html: noFlashThemeScript }} />
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
