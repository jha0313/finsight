// 자동 리뷰 게이트(minor 분기) 검증용 임시 파일. 테스트 후 삭제.
// 경미한 엣지케이스 결함: 빈 배열이면 0으로 나눠 NaN을 반환한다(치명적이지 않은 미처리).

export function averageAmount(amounts: number[]): number {
  const total = amounts.reduce((a, b) => a + b, 0);
  return total / amounts.length;
}
