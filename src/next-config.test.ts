import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

describe("next security headers", () => {
  it("applies baseline browser hardening headers to every route", async () => {
    await expect(nextConfig.headers?.()).resolves.toEqual([
      {
        source: "/:path*",
        headers: expect.arrayContaining([
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: expect.any(String) },
        ]),
      },
    ]);
  });

  it("keeps the content security policy restrictive while allowing required PostHog ingest endpoints", async () => {
    const entries = await nextConfig.headers?.();
    const csp = entries?.[0]?.headers.find(
      (header) => header.key === "Content-Security-Policy",
    )?.value;

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain(
      "connect-src 'self' https://us.i.posthog.com https://us-assets.i.posthog.com",
    );
  });
});