<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into finsight. Client-side tracking is initialized via `instrumentation-client.ts` (Next.js 15.3+ pattern) with a reverse proxy configured in `next.config.ts` to route events through `/ingest`. A server-side PostHog client (`src/lib/posthog-server.ts`) is used in API routes and server actions. Users are identified server-side in the auth callback (Google OAuth) via `posthog-node`. Eight events cover the core product lifecycle: statement uploads, analyses, failures, Pro checkout, subscription management, and sign-in/out.

| Event | Description | File |
|---|---|---|
| `statement_uploaded` | User submits a CSV or PDF statement file for analysis | `src/components/UploadPanel.tsx` |
| `statement_analyzed` | Statement analysis completes successfully and results are displayed | `src/components/UploadPanel.tsx` |
| `analysis_failed` | Statement analysis request fails due to a network or server error | `src/components/UploadPanel.tsx` |
| `checkout_initiated` | User initiates the Pro subscription checkout flow | `src/app/api/checkout/route.ts` |
| `subscription_canceled` | User requests cancellation of their Pro subscription at period end | `src/app/api/subscription/cancel/route.ts` |
| `subscription_resumed` | User resumes their Pro subscription after scheduling a cancellation | `src/app/api/subscription/cancel/route.ts` |
| `user_signed_in` | User completes Google OAuth sign-in and a session is established | `src/app/auth/callback/route.ts` |
| `user_signed_out` | User signs out of their account | `src/app/(dashboard)/actions.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) dashboard](https://us.posthog.com/project/481905/dashboard/1747552)
- [Statement uploads & analyses (30d)](https://us.posthog.com/project/481905/insights/gj9fm23C)
- [Daily new sign-ins (30d)](https://us.posthog.com/project/481905/insights/vAJbouO3)
- [Pro upgrade funnel (30d)](https://us.posthog.com/project/481905/insights/FKmXzpiA)
- [Subscription cancellations vs. resumes (30d)](https://us.posthog.com/project/481905/insights/NhdObauw)
- [Analysis failure rate (30d)](https://us.posthog.com/project/481905/insights/OaHGBCgC)

## Verify before merging

- [ ] Run a full production build (`npm run build`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite (`npm run test`) — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.example` and any bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.
- [ ] Confirm the returning-visitor path also calls `identify` — currently identification happens only at the OAuth callback; a user who is already logged in and returns via a fresh session will not be re-identified until they sign in again.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
