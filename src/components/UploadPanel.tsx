"use client";

import { FileUp, LoaderCircle } from "lucide-react";
import { type ChangeEvent, type FormEvent, useState } from "react";

import { DashboardResults } from "@/components/DashboardResults";
import type { AnalyzeResponse } from "@/types/analysis";

type UploadStatus = "idle" | "loading" | "success" | "error";

export function UploadPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AnalyzeResponse | null>(null);

  const isLoading = status === "loading";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (file === null) {
      setError("분석할 CSV 파일을 선택하세요.");
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
            <h2 className="title-md">CSV 명세서 업로드</h2>
            <p className="body-sm mt-xs">
              카드 또는 은행 CSV를 올리면 지출 구조와 이상 거래를 한 화면에
              정리합니다.
            </p>
          </div>

          <form className="grid gap-base sm:grid-cols-[1fr_auto]" onSubmit={handleSubmit}>
            <label className="block">
              <span className="caption">CSV 파일</span>
              <input
                accept=".csv,text/csv"
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
