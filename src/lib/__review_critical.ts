// 자동 리뷰 게이트(critical 분기) 검증용 임시 파일. 테스트 후 삭제.
// 의도적 finsight CRITICAL 위반: 금액은 numeric/BigInt minor-unit이 정본인데
// parseFloat로 부동소수를 쓴다(정밀도 손실 → 모든 금액 분석이 조용히 틀어짐).

export function parseStatementAmount(raw: string): number {
  return parseFloat(raw.replace(/[,$]/g, ""));
}
