// 사이트 메타 단일 소스 — metadataBase·robots·sitemap·JSON-LD가 모두 이 값을 참조한다.
// 커스텀 도메인으로 전환할 때 NEXT_PUBLIC_SITE_URL 한 줄만 바꾸면 전부 따라온다.
// (미설정 시 Vercel production alias를 기본값으로 쓴다.)
const DEFAULT_SITE_URL = "https://finsight-lilac.vercel.app";

/** 후행 슬래시를 제거해 canonical/OG URL의 절대 기준을 단일화한다. */
export function resolveSiteUrl(raw: string | undefined): string {
  const value = raw?.trim() ? raw.trim() : DEFAULT_SITE_URL;
  return value.replace(/\/+$/, "");
}

export const siteUrl = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export const siteConfig = {
  name: "finsight",
  title: "finsight — 명세서에서 지출의 구조를 읽다",
  description:
    "카드·은행 명세서 CSV를 업로드하면 Claude가 지출 구조·이상 거래·절약 인사이트를 분석해 보여주는 핀테크 대시보드.",
  locale: "ko_KR",
  url: siteUrl,
} as const;
