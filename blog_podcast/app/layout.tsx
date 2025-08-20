import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Blog Podcast Generator",
  description: "Generate engaging podcast episodes from your favorite blogs using AI and Google Cloud Text-to-Speech.",
  keywords: ["podcast", "blog", "AI", "text-to-speech", "generator", "Gemini", "Google Cloud"],
  openGraph: {
    title: "Blog Podcast Generator",
    description: "Turn blogs into podcasts instantly with AI and TTS.",
    url: process.env.NEXT_PUBLIC_APP_URL || "https://example.com",
    type: "website",
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_APP_URL || "https://example.com"}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Blog Podcast Generator Open Graph Image",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
