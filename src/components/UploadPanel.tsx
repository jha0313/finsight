"use client";

import { FileUp, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";

import { DashboardResults } from "@/components/DashboardResults";
import type { AnalyzeResponse } from "@/types/analysis";
import type { Tier } from "@/types/tier";

export interface UploadPanelProps {
  // 서버 세션에서 판정한 구독 tier(SSR). 결제 직후 저장된 분석이 아직 Free일 때
  // 자동 재분석을 트리거하는 기준이다.
  serverTier: Tier;
}

type UploadStatus = "idle" | "loading" | "success" | "error";

// 결제 체크아웃처럼 외부로 이동했다 돌아와도(redirect) 직전 분석 결과를
// 복원하기 위한 세션 저장 키. 탭을 닫으면 비워진다.
const ANALYSIS_STORAGE_KEY = "finsight:last-analysis";

// 결제 직후 구독 웹훅 반영에 약간의 지연이 있을 수 있어, Pro로 보일 때까지
// 짧게 재시도한다(웹훅 레이스 방어).
const CHECKOUT_REFRESH_ATTEMPTS = 5;
const CHECKOUT_REFRESH_INTERVAL_MS = 1500;

export function UploadPanel({ serverTier }: UploadPanelProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AnalyzeResponse | null>(null);
  const [checkoutRefreshing, setCheckoutRefreshing] = useState(false);

  const isLoading = status === "loading";

  // 마운트 시 직전 분석 결과를 복원해, 체크아웃 redirect 후 화면이 빈 상태로
  // 초기화되지 않게 한다.
  useEffect(() => {
    const stored = sessionStorage.getItem(ANALYSIS_STORAGE_KEY);

    if (stored === null) {
      return;
    }

    try {
      setResponse(JSON.parse(stored) as AnalyzeResponse);
    } catch {
      sessionStorage.removeItem(ANALYSIS_STORAGE_KEY);
    }
  }, []);

  // 결제 후 저장된 마지막 명세서를 서버에서 Pro(Opus)로 자동 재분석해 잠금
  // 화면을 심층 분석으로 교체한다. 원본 파일은 redirect 후 클라이언트에 남지
  // 않으므로 재업로드 없이 갱신한다. 트리거는 두 가지:
  //  (1) ?checkout=success — 결제 직후 복귀(웹훅 반영 레이스 대비 재시도).
  //  (2) 서버 구독은 Pro인데 저장된 분석이 아직 Pro가 아님 — 새로고침만으로도
  //      복구되도록 보장(결제 직후 폴링 윈도우를 놓쳤을 때의 안전망).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutReturn = params.get("checkout") === "success";
    const storedStale = serverTier === "pro" && isStoredAnalysisStale();

    if (!checkoutReturn && !storedStale) {
      return;
    }

    if (checkoutReturn) {
      // 새로고침 시 중복 트리거되지 않도록 쿼리를 즉시 제거한다.
      window.history.replaceState(null, "", window.location.pathname);
    }

    let cancelled = false;

    async function refreshAfterCheckout() {
      setCheckoutRefreshing(true);

      try {
        for (let attempt = 0; attempt < CHECKOUT_REFRESH_ATTEMPTS; attempt++) {
          const latestResponse = await fetch("/api/analyze/latest", {
            method: "POST",
          });

          // 분석한 명세서가 없거나(404) 인증 만료 등(4xx/5xx)이면 기존 화면을
          // 유지한다.
          if (!latestResponse.ok) {
            return;
          }

          const result = (await latestResponse.json()) as AnalyzeResponse;

          if (cancelled) {
            return;
          }

          // tier가 pro로 보이면 구독이 반영된 것 — 결과를 채택하고 멈춘다.
          // 아직 free면 웹훅 반영을 기다리며 잠깐 후 재시도한다.
          if (result.tier === "pro") {
            setResponse(result);
            setStatus("success");
            sessionStorage.setItem(ANALYSIS_STORAGE_KEY, JSON.stringify(result));
            // 사이드바 Plan 배지(서버 컴포넌트)까지 최신 구독으로 다시 렌더한다.
            router.refresh();
            return;
          }

          if (attempt < CHECKOUT_REFRESH_ATTEMPTS - 1) {
            await delay(CHECKOUT_REFRESH_INTERVAL_MS);
          }
        }
      } catch {
        // 네트워크 오류 시 기존 화면을 유지한다.
      } finally {
        if (!cancelled) {
          setCheckoutRefreshing(false);
        }
      }
    }

    void refreshAfterCheckout();

    return () => {
      cancelled = true;
    };
  }, [serverTier, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (file === null) {
      setError("분석할 CSV 또는 PDF 파일을 선택하세요.");
      setStatus("error");
      return;
    }

    const formData = new FormData();
    formData.set("file", file);

    setError(null);
    setStatus("loading");

    try {
      const analyzeResponse = await fetch("/api/analyze", {
        body: formData,
        method: "POST",
      });

      if (!analyzeResponse.ok) {
        setResponse(null);
        setError(errorMessageForStatus(analyzeResponse.status));
        setStatus("error");
        return;
      }

      const result = (await analyzeResponse.json()) as AnalyzeResponse;
      setResponse(result);
      setStatus("success");
      sessionStorage.setItem(ANALYSIS_STORAGE_KEY, JSON.stringify(result));
    } catch {
      setResponse(null);
      setError("분석 요청을 처리하지 못했습니다.");
      setStatus("error");
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setError(null);
  }

  return (
    <div className="space-y-lg">
      <article className="rounded-card border border-hairline bg-canvas p-xl">
        <div className="grid gap-xl lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <h2 className="title-md">명세서 업로드</h2>
            <p className="body-sm mt-xs">
              카드 또는 은행 명세서(CSV·PDF)를 올리면 지출 구조와 이상 거래를 한
              화면에 정리합니다.
            </p>
          </div>

          <form className="grid gap-base sm:grid-cols-[1fr_auto]" onSubmit={handleSubmit}>
            <label className="block">
              <span className="caption">CSV 또는 PDF 파일</span>
              <input
                accept=".csv,.pdf,text/csv,application/pdf"
                className="body-sm mt-xs block w-full rounded-field border border-hairline bg-canvas px-base py-sm text-ink file:mr-base file:rounded-action file:border-0 file:bg-surface-strong file:px-base file:py-xs file:text-ink"
                disabled={isLoading}
                onChange={handleFileChange}
                type="file"
              />
            </label>
            <button
              className="btn-label inline-flex min-h-12 items-center justify-center gap-sm rounded-action bg-primary px-lg text-on-primary transition-colors hover:bg-primary-active disabled:bg-primary-disabled"
              disabled={file === null || isLoading}
              type="submit"
            >
              {isLoading ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="animate-spin"
                  size={18}
                  strokeWidth={2}
                />
              ) : (
                <FileUp aria-hidden="true" size={18} strokeWidth={2} />
              )}
              명세서 분석
            </button>
          </form>
        </div>

        {isLoading ? (
          <p className="body-sm mt-base" role="status">
            분석 중입니다.
          </p>
        ) : null}

        {checkoutRefreshing ? (
          <p className="body-sm mt-base" role="status">
            Pro 구독을 확인하고 심층 분석을 적용하는 중입니다.
          </p>
        ) : null}

        {error === null ? null : (
          <p className="body-sm mt-base text-semantic-down" role="alert">
            {error}
          </p>
        )}
      </article>

      {response === null ? (
        <section
          aria-label="빈 분석 결과"
          className="rounded-card border border-hairline bg-surface-soft p-xl"
        >
          <p className="title-md">분석 결과가 아직 없습니다.</p>
          <p className="body-sm mt-xs">
            업로드가 완료되면 Free 분석과 Pro 상태가 같은 화면에 표시됩니다.
          </p>
        </section>
      ) : (
        <DashboardResults response={response} />
      )}
    </div>
  );
}

function errorMessageForStatus(status: number): string {
  if (status === 401) {
    return "로그인이 필요합니다. 다시 로그인한 뒤 시도하세요.";
  }

  return "분석 요청을 처리하지 못했습니다.";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// 저장된 분석이 Pro로 적용되기 전(잠금/사용불가) 상태인지. 서버 구독이 Pro인데
// 이 값이 true면 결제 직후 Free 결과만 저장된 것이므로 재분석이 필요하다.
function isStoredAnalysisStale(): boolean {
  const stored = sessionStorage.getItem(ANALYSIS_STORAGE_KEY);

  if (stored === null) {
    return false;
  }

  try {
    return (JSON.parse(stored) as AnalyzeResponse).pro.status !== "active";
  } catch {
    return false;
  }
}
