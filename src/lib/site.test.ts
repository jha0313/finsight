import { describe, expect, it } from "vitest";

import { resolveSiteUrl, siteConfig, siteUrl } from "./site";

describe("resolveSiteUrl", () => {
  it("빈 값이면 기본 도메인으로 폴백한다", () => {
    expect(resolveSiteUrl(undefined)).toBe("https://finsight-lilac.vercel.app");
    expect(resolveSiteUrl("")).toBe("https://finsight-lilac.vercel.app");
    expect(resolveSiteUrl("   ")).toBe("https://finsight-lilac.vercel.app");
  });

  it("후행 슬래시를 제거해 canonical 기준을 단일화한다", () => {
    expect(resolveSiteUrl("https://finsight.app/")).toBe("https://finsight.app");
    expect(resolveSiteUrl("https://finsight.app///")).toBe(
      "https://finsight.app",
    );
  });

  it("앞뒤 공백을 정리한다", () => {
    expect(resolveSiteUrl("  https://finsight.app  ")).toBe(
      "https://finsight.app",
    );
  });
});

describe("siteConfig", () => {
  it("절대 URL은 슬래시 없이 정규화된 siteUrl과 일치한다", () => {
    expect(siteConfig.url).toBe(siteUrl);
    expect(siteUrl.endsWith("/")).toBe(false);
  });
});
