import { describe, expect, it } from "vitest";

import { siteUrl } from "../lib/site";

import robots from "./robots";

describe("robots", () => {
  it("sitemap을 siteUrl 기준 절대경로로 가리킨다", () => {
    expect(robots().sitemap).toBe(`${siteUrl}/sitemap.xml`);
  });

  it("인증·API·콜백 경로를 차단한다", () => {
    const { rules } = robots();
    expect(Array.isArray(rules)).toBe(false);
    const { disallow } = rules as { disallow: string[] };
    expect(disallow).toContain("/dashboard");
    expect(disallow).toContain("/api/");
    expect(disallow).toContain("/auth/");
  });

  it("공개 루트는 허용한다", () => {
    const { rules } = robots();
    expect((rules as { allow: string }).allow).toBe("/");
  });
});
