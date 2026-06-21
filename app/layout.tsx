import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Staffing Platform",
  description: "A platform that uses AI to help companies find the right tech talent and help candidates prepare for interviews.  Built with Next.js, Supabase, and OpenAI. Created by Kalya S. and ChatGPT.  Check out the code on GitHub: https://github.com/kalyas/ai-staffing-platform ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body>
  <Header />
  {children}
</body>
    </html>
  );
}
