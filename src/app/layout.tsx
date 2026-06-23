import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "finsight",
  description:
    "카드·은행 명세서 CSV를 업로드하면 Claude가 지출 구조·이상 거래·절약 인사이트를 분석해 보여주는 핀테크 대시보드.",
  openGraph: {
    title: "finsight",
    description:
      "카드·은행 명세서 CSV를 업로드하면 Claude가 지출 구조·이상 거래·절약 인사이트를 분석해 보여주는 핀테크 대시보드.",
    type: "website",
    locale: "ko_KR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
