import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "phoenix-os Simple",
  description: "レース条件と馬場傾向から勝ち馬に求められる型を言語化する思考整理ツール",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
