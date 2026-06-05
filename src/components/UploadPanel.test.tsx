import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalyzeResponse } from "@/types/analysis";

import { UploadPanel } from "./UploadPanel";

// 실제 useRouter처럼 안정적인 참조를 반환해야 useEffect 의존성이 흔들리지 않는다.
const navMocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navMocks,
}));

const analyzeResponse: AnalyzeResponse = {
  tier: "free",
  free: {
    byCategory: [{ category: "food", total: "120000.00", count: 8 }],
    trend: [{ period: "2026-06", total: "120000.00" }],
    anomalies: [
      {
        kind: "category_outlier",
        severity: "high",
        merchant: "전자상거래",
        detail: "평균보다 큰 지출입니다.",
      },
    ],
  },
  pro: {
    status: "locked",
  },
};

describe("UploadPanel", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the initial upload state", () => {
    render(<UploadPanel serverTier="free" />);

    expect(screen.getByLabelText("CSV 또는 PDF 파일")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "명세서 분석" }),
    ).toBeDisabled();
    expect(screen.getByText("분석 결과가 아직 없습니다.")).toBeInTheDocument();
  });

  it("posts the selected CSV to /api/analyze and renders the result", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(analyzeResponse), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );
    render(<UploadPanel serverTier="free" />);

    selectCsvFile();
    fireEvent.click(screen.getByRole("button", { name: "명세서 분석" }));

    expect(screen.getByText("분석 중입니다.")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/analyze");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get("file")).toBeInstanceOf(File);

    expect(await screen.findByText("카테고리별 지출")).toBeInTheDocument();
    expect(screen.getByText("전자상거래")).toBeInTheDocument();
    expect(screen.getByText("Pro 분석 잠금")).toBeInTheDocument();
  });

  it("renders an error state when analyze fails", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "failed" }), {
        headers: { "content-type": "application/json" },
        status: 500,
      }),
    );
    render(<UploadPanel serverTier="free" />);

    selectCsvFile();
    fireEvent.click(screen.getByRole("button", { name: "명세서 분석" }));

    expect(
      await screen.findByText("분석 요청을 처리하지 못했습니다."),
    ).toBeInTheDocument();
    expect(screen.getByText("분석 결과가 아직 없습니다.")).toBeInTheDocument();
  });

  it("auto-re-analyzes the latest statement and unlocks Pro after returning from checkout", async () => {
    window.history.replaceState(null, "", "/dashboard?checkout=success");
    const proResponse: AnalyzeResponse = {
      tier: "pro",
      free: analyzeResponse.free,
      pro: {
        status: "active",
        insights: { summary: "Opus 심층 분석", insights: ["절약 인사이트"] },
      },
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(proResponse), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    render(<UploadPanel serverTier="free" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/analyze/latest");
    expect(init?.method).toBe("POST");

    // 잠금 화면이 Opus 심층 분석으로 교체되고 업그레이드 버튼은 사라진다.
    expect(await screen.findByText("Opus 심층 분석")).toBeInTheDocument();
    expect(screen.queryByText("Pro 분석 잠금")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Pro로 업그레이드/ }),
    ).not.toBeInTheDocument();
    // 새로고침 재트리거 방지를 위해 쿼리를 제거한다.
    expect(window.location.search).toBe("");
  });

  it("does not auto-refresh without the checkout=success flag", () => {
    window.history.replaceState(null, "", "/dashboard");

    render(<UploadPanel serverTier="free" />);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("auto-re-analyzes on plain reload when server is Pro but stored analysis is still locked", async () => {
    // 결제 직후 폴링 윈도우를 놓쳐 Free(잠금) 분석만 저장된 상태를 재현.
    // checkout 쿼리 없이 새로고침만으로도 복구되어야 한다.
    window.history.replaceState(null, "", "/dashboard");
    sessionStorage.setItem(
      "finsight:last-analysis",
      JSON.stringify(analyzeResponse),
    );
    const proResponse: AnalyzeResponse = {
      tier: "pro",
      free: analyzeResponse.free,
      pro: {
        status: "active",
        insights: { summary: "Opus 심층 분석", insights: ["절약 인사이트"] },
      },
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(proResponse), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    render(<UploadPanel serverTier="pro" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/analyze/latest");
    expect(await screen.findByText("Opus 심층 분석")).toBeInTheDocument();
    expect(screen.queryByText("Pro 분석 잠금")).not.toBeInTheDocument();
  });

  it("does not re-analyze on reload when stored analysis already matches Pro", async () => {
    window.history.replaceState(null, "", "/dashboard");
    sessionStorage.setItem(
      "finsight:last-analysis",
      JSON.stringify({
        tier: "pro",
        free: analyzeResponse.free,
        pro: { status: "active", insights: { summary: "s", insights: [] } },
      }),
    );

    render(<UploadPanel serverTier="pro" />);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the empty state when there is no stored statement to re-analyze", async () => {
    window.history.replaceState(null, "", "/dashboard?checkout=success");
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

    render(<UploadPanel serverTier="free" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText("분석 결과가 아직 없습니다."),
    ).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });
});

function selectCsvFile(): void {
  const input = screen.getByLabelText("CSV 또는 PDF 파일");
  const file = new File(
    ["date,merchant,amount\n2026-06-01,카페,5500"],
    "statement.csv",
    { type: "text/csv" },
  );

  fireEvent.change(input, {
    target: {
      files: [file],
    },
  });
}
