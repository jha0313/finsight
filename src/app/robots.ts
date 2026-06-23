import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

// 공개 페이지는 크롤 허용, 인증·API·콜백 경로는 차단한다.
// (대시보드는 RLS로 막혀 크롤되지 않지만 크롤 예산 낭비를 막기 위해 명시한다.)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api/", "/auth/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
