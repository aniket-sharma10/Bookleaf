import type { Metadata } from "next";
import { Geist, Source_Serif_4 } from "next/font/google";

import { cn } from "@/lib/utils";

import "./globals.css";

// Geist for interface text; a book serif for headings (`font-heading`).
const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: {
    default: "BookLeaf Author Support",
    template: "%s · BookLeaf Author Support",
  },
  description:
    "Author support and communication portal for BookLeaf Publishing",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("font-sans", sans.variable, serif.variable)}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
