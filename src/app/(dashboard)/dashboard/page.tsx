import type { Metadata } from "next";

import { UploadPanel } from "@/components/UploadPanel";
import { getCurrentUser, getSubscriptionSummary } from "@/services/supabase";

export const metadata: Metadata = {
  title: "대시보드",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const tier = user ? (await getSubscriptionSummary(user.id)).tier : "free";

  return (
    <main className="min-h-screen bg-canvas">
      <section className="border-b border-hairline bg-canvas">
        <div className="mx-auto flex w-full max-w-finsight flex-col gap-base px-lg py-xxl">
          <p className="caption-strong">대시보드</p>
          <div className="max-w-3xl">
            <h1 className="display-sm">명세서를 업로드하고 지출 구조를 확인합니다.</h1>
            <p className="body-md mt-base">
              CSV·PDF를 서버 분석 흐름에 전달해 Free 분석을 먼저 표시하고, Pro
              심층 분석은 응답 상태에 따라 잠금 또는 사용 불가로 구분합니다.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-surface-soft">
        <div className="mx-auto w-full max-w-finsight px-lg py-xxl">
          <UploadPanel serverTier={tier} />
        </div>
      </section>
    </main>
  );
}
