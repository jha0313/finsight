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

const analyzeResponse: AnalyzeResponse = {
  tier: "free",
  free: {
    byCategory: [{ category: "food", total: "120000.00", count: 8 }],
    trend: [{ period: "2026-06", total: "120000.00" }],
    anomalies: [
      {
        kind: "outlier",
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
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the initial upload state", () => {
    render(<UploadPanel />);

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
    render(<UploadPanel />);

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
    render(<UploadPanel />);

    selectCsvFile();
    fireEvent.click(screen.getByRole("button", { name: "명세서 분석" }));

    expect(
      await screen.findByText("분석 요청을 처리하지 못했습니다."),
    ).toBeInTheDocument();
    expect(screen.getByText("분석 결과가 아직 없습니다.")).toBeInTheDocument();
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
