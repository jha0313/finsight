import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  createGoogleOAuthUrl,
  isSupabaseConfigured,
  sanitizeRedirectPath,
} from "@/services/supabase";

export const metadata: Metadata = {
  title: "로그인",
  // 로그인 페이지는 색인 가치가 없으므로 크롤은 허용하되 색인은 막는다.
  robots: { index: false, follow: true },
};

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
    next?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeRedirectPath(firstParam(params?.next));
  const hasError = firstParam(params?.error) !== undefined;

  return (
    <main className="min-h-screen bg-surface-soft px-base py-xxl">
      <section className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-[480px] items-center">
        <div className="w-full rounded-card border border-hairline bg-canvas p-xl">
          <p className="caption-strong text-primary">finsight</p>
          <h1 className="title-lg mt-lg">로그인</h1>
          <p className="body-md mt-sm">구글 계정으로 계속하세요.</p>
          {hasError ? (
            <p className="body-sm mt-base text-semantic-down">
              로그인 연결을 완료하지 못했습니다.
            </p>
          ) : null}
          <form action={signInWithGoogle} className="mt-xl">
            <input name="next" type="hidden" value={nextPath} />
            <button
              className="btn-label w-full rounded-action bg-primary px-lg py-base text-on-primary transition-colors hover:bg-primary-active"
              type="submit"
            >
              Google로 계속하기
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

async function signInWithGoogle(formData: FormData): Promise<void> {
  "use server";

  const nextPath = sanitizeRedirectPath(formData.get("next")?.toString());
  const origin = await getRequestOrigin();

  // Supabase 미설정 환경에서는 getCurrentUser·middleware와 동일하게 우아하게
  // 강등한다(500 throw 대신 에러 표시된 로그인 페이지로 redirect).
  if (!isSupabaseConfigured()) {
    redirect(buildLoginErrorUrl(origin, nextPath));
  }

  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", nextPath);

  const oauthUrl = await createGoogleOAuthUrl(callbackUrl.toString());

  if (oauthUrl === null) {
    redirect(buildLoginErrorUrl(origin, nextPath));
  }

  redirect(oauthUrl);
}

function buildLoginErrorUrl(origin: string, nextPath: string): string {
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "oauth");
  loginUrl.searchParams.set("next", nextPath);

  return loginUrl.toString();
}

async function getRequestOrigin(): Promise<string> {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    "localhost:3000";
  const protocol =
    headerStore.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
