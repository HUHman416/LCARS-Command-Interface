import type { Metadata } from "next";
import "./globals.css";
import "./v23-1.css";
export const metadata: Metadata = { title: "LCARS Command Interface", description: "LCARS-inspired Nobara and Fedora desktop dashboard." };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en" suppressHydrationWarning><body>{children}</body></html>; }
