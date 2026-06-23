import { describe, expect, it } from "vitest";

import { siteUrl } from "../lib/site";

import sitemap from "./sitemap";

describe("sitemap", () => {
  it("공개 라우트(루트·로그인)를 포함한다", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain(`${siteUrl}/`);
    expect(urls).toContain(`${siteUrl}/login`);
  });

  it("모든 항목은 siteUrl 절대경로다", () => {
    for (const entry of sitemap()) {
      expect(entry.url.startsWith(siteUrl)).toBe(true);
    }
  });

  it("루트가 최고 우선순위다", () => {
    const root = sitemap().find((entry) => entry.url === `${siteUrl}/`);
    expect(root?.priority).toBe(1);
  });
});
