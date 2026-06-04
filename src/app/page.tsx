import {
  ChartNoAxesCombined,
  CircleDollarSign,
  Database,
  FileUp,
  LockKeyhole,
  ScanEye,
  ShieldCheck,
  Siren,
} from "lucide-react";

import { getSampleDemoAnalysis } from "@/app/_demo/sample-demo";
import { SampleDemoSection } from "@/app/_demo/SampleDemoSection";
import { FeatureGrid } from "@/components/FeatureGrid";
import { Hero } from "@/components/Hero";
import { PricingTable } from "@/components/PricingTable";
import { SecuritySection } from "@/components/SecuritySection";

const iconProps = {
  "aria-hidden": "true",
  size: 22,
  strokeWidth: 2,
} as const;

const features = [
  {
    description:
      "카드와 은행 CSV를 올리면 표준 파서가 먼저 읽고, 필요한 경우에만 매핑 확인으로 이어집니다.",
    icon: <FileUp {...iconProps} />,
    title: "CSV 업로드",
  },
  {
    description:
      "카테고리별 지출과 기간별 흐름을 한 화면에서 비교할 수 있게 정리합니다.",
    icon: <ChartNoAxesCombined {...iconProps} />,
    title: "지출 구조",
  },
  {
    description:
      "반복 결제, 구독 누수, 평소보다 큰 거래를 규칙 기반으로 먼저 드러냅니다.",
    icon: <Siren {...iconProps} />,
    title: "이상 거래",
  },
  {
    description:
      "Free는 Sonnet 요약을 제공하고, Pro는 Opus로 절약 판단을 더 깊게 확장합니다.",
    icon: <CircleDollarSign {...iconProps} />,
    title: "절약 인사이트",
  },
];

const securityItems = [
  {
    description:
      "카드·계좌번호는 적재 시 마스킹하고 전체 PAN은 평문으로 저장하지 않습니다.",
    icon: <ShieldCheck {...iconProps} />,
    title: "식별자 마스킹",
  },
  {
    description:
      "RLS 정책으로 사용자별 명세서 접근을 DB 레벨에서 격리합니다.",
    icon: <LockKeyhole {...iconProps} />,
    title: "사용자별 격리",
  },
  {
    description:
      "Claude에는 가맹점명, 금액, 날짜, 카테고리처럼 마스킹된 거래 단위만 전달합니다.",
    icon: <ScanEye {...iconProps} />,
    title: "마스킹 전송",
  },
  {
    description:
      "분석과 저장은 단일 트랜잭션 경계를 기준으로 처리해 중간 실패를 남기지 않습니다.",
    icon: <Database {...iconProps} />,
    title: "저장 경계",
  },
];

const plans = [
  {
    ctaHref: "/login",
    ctaLabel: "Free로 시작",
    description:
      "매달 명세서를 가볍게 점검하는 기본 분석입니다.",
    features: [
      "규칙·통계 기반 카테고리 분석",
      "기간별 지출 추이",
      "이상 거래와 구독 누수 탐지",
      "Claude Sonnet 자연어 요약",
    ],
    name: "Free",
    price: "₩0",
  },
  {
    ctaHref: "/login",
    ctaLabel: "Pro 시작",
    description:
      "절약 판단을 더 깊게 보고 싶은 사용자를 위한 심층 분석입니다.",
    features: [
      "Free 분석 전체 포함",
      "Claude Opus 심층 분석",
      "고급 절약 인사이트",
      "Pro 잠금 해제 결과 표시",
    ],
    name: "Pro",
    price: "구독",
  },
];

export default async function Home() {
  const sampleDemoAnalysis = await getSampleDemoAnalysis();

  return (
    <main className="min-h-screen bg-canvas">
      <Hero
        brandName="finsight"
        ctaHref="/login"
        ctaLabel="Google로 시작"
        demoSlot={{
          description:
            "아래 샘플 영역에서 실제 분석 결과를 먼저 확인할 수 있습니다.",
          label: "샘플 데모",
          title: "샘플 명세서 미리보기",
        }}
        description="CSV 명세서를 올리면 지출 구조와 이상 거래를 먼저 정리하고, AI가 절약 인사이트를 덧붙입니다."
        headline="명세서에서 지출의 구조를 읽습니다"
        preview={{
          amount: "₩2,480,000",
          amountLabel: "이번 달 지출",
          delta: "-18%",
          period: "2026.06",
          rows: [
            { label: "식비", tone: "down", value: "₩842,000" },
            { label: "교통", value: "₩184,000" },
            { label: "환불", tone: "up", value: "-₩24,000" },
          ],
          title: "정적 대시보드 미리보기",
        }}
      />

      <FeatureGrid
        demoSlot={<SampleDemoSection analysis={sampleDemoAnalysis} />}
        description="업로드된 명세서를 결정론적으로 파싱한 뒤, 지출 구조와 이상 거래를 먼저 보여주고 AI 요약을 붙입니다."
        eyebrow="핵심 가치"
        features={features}
        title="임의의 명세서를 이해 가능한 지출 화면으로 바꿉니다"
      />

      <SecuritySection
        description="분석에 필요한 정보만 남기고 직접 식별자는 저장과 외부 전송의 경계 밖으로 밀어냅니다."
        eyebrow="신뢰와 보안"
        items={securityItems}
        title="분석보다 먼저 지키는 경계"
      />

      <PricingTable
        description="Free 분석으로 시작하고, 더 깊은 절약 판단이 필요할 때 Pro를 활성화합니다."
        eyebrow="가격"
        plans={plans}
        title="필요한 깊이만 선택합니다"
      />
    </main>
  );
}
