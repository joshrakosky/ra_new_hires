import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stryker Christmas Store",
  description: "Holiday product selection for Stryker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50">
        {children}
      </body>
    </html>
  );
}
