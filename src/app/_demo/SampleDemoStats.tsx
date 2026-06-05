"use client";

import { FileSpreadsheet, Siren, WalletCards } from "lucide-react";

import { StatCard } from "@/components/StatCard";
import { useCountUp } from "@/hooks/useCountUp";
import { useInView } from "@/hooks/useInView";
import { formatMoney } from "@/lib/format";

const iconProps = {
  "aria-hidden": "true",
  size: 20,
  strokeWidth: 2,
} as const;

export interface SampleDemoStatsProps {
  anomalyCount: number;
  subscriptionLeakCount: number;
  totalSpend: string;
  transactionCount: number;
}

/**
 * 샘플 데모 통계 카드(거래 수·샘플 지출·탐지 알림)에 inView 진입 시 카운트업을 입히는 client 래퍼.
 * StatCard 자체는 props만 받는 dumb 컴포넌트로 보존하고, 여기서 애니메이션된 숫자 문자열을 value로 넘긴다.
 * - prefers-reduced-motion / IntersectionObserver 미지원 → useCountUp·useInView 폴백으로 즉시 최종값.
 */
export function SampleDemoStats({
  anomalyCount,
  subscriptionLeakCount,
  totalSpend,
  transactionCount,
}: SampleDemoStatsProps) {
  const [ref, inView] = useInView();

  const transactionValue = useCountUp(transactionCount, { start: inView });
  const spendValue = useCountUp(Number(totalSpend), { start: inView });
  const anomalyValue = useCountUp(anomalyCount, { start: inView });

  return (
    <div className="grid gap-base sm:grid-cols-3" ref={ref}>
      <StatCard
        detail="번들 CSV"
        icon={<FileSpreadsheet {...iconProps} />}
        label="거래 수"
        value={`${Math.round(transactionValue)}`}
      />
      <StatCard
        detail="3개월 합계"
        icon={<WalletCards {...iconProps} />}
        label="샘플 지출"
        value={formatMoney(`${Math.round(spendValue)}`)}
      />
      <StatCard
        detail={`구독 후보 ${subscriptionLeakCount}`}
        icon={<Siren {...iconProps} />}
        label="탐지 알림"
        value={`${Math.round(anomalyValue)}`}
      />
    </div>
  );
}
