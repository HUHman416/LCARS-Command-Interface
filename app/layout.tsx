import type { Metadata } from "next";
import "./globals.css";
import "./v23-1.css";
import "./v23-2.css";
import "./v24.css";
import "./v24-1.css";
import "./v25.css";
import "./v26-1.css";
import "./v26.css";
import "./v26-2.css";
import "./v26-3.css";
import "./v27-1.css";
import "./v27-2.css";
export const metadata: Metadata = { title: "LCARS Command Interface", description: "LCARS-inspired Nobara and Fedora desktop dashboard.", other: { "codex-preview": "development" } };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en" suppressHydrationWarning><body>{children}</body></html>; }
