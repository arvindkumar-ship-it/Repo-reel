import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { BRAND } from "@reporeel/shared";
import "../styles/globals.css";
import "@xyflow/react/dist/style.css";
import { ToastProvider } from "../components/ui/primitives";
export const metadata: Metadata = {
  icons: { icon: "/favicon.svg" },
  title: {
    default: BRAND.name + " — From repository to understanding",
    template: "%s · " + BRAND.name,
  },
  description:
    "Turn your GitHub repository into an interactive architecture diagram and an animated code walkthrough.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
