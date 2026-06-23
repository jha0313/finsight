import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

// 공개 라우트만 노출한다. 대시보드·설정은 인증 뒤라 색인 대상이 아니다.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: `${siteUrl}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/login`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
