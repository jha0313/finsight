import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NEXT_DIST_DIR로 빌드 출력 디렉토리를 격리할 수 있게 하는 스위치.
  // 평소 dev/build는 .next를 쓰고, 외부 build(verify-gate 등)와 .next 레이스가
  // 날 때 scripts/dev-doctor.sh가 NEXT_DIST_DIR=.next-dev로 dev를 격리 재시작한다.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
