import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BookLeaf Author Support",
  description:
    "Author support and communication portal for BookLeaf Publishing",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
