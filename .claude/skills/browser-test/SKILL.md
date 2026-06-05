---
name: browser-test
description: finsight를 실제 브라우저(dev-browser)로 검증하는 스킬. docs/BROWSER_TESTING.md 플레이북의 그룹 A/B 유스케이스 시나리오를 실행한다. "브라우저 테스트", "브라우저 테스팅", "browser test", "dev-browser로 확인", "랜딩/대시보드 화면 확인", "시나리오 돌려줘", "UI가 실제로 뜨는지 확인", "화면 깨졌는지 봐줘" 같은 요청에 트리거. 환경(dev 서버) 헬스체크를 먼저 하고, 그룹 A(키 불필요)→그룹 B(우회) 순으로 실행하며 스크린샷·결과를 기록한다.
user-invocable: true
---

finsight를 실제 브라우저로 검증하는 절차. **시나리오 정의는 `docs/BROWSER_TESTING.md`(플레이북)에 있다.** 이 스킬은 그 플레이북을 dev-browser로 실행하는 방법과, 매번 반복되는 함정 회피법을 담는다.

## 0. 환경 먼저 (가장 중요)

테스트 전에 **반드시** dev 서버 정상성부터 확인한다. dev가 LISTEN 중이어도 외부 build가 `.next`를 덮으면 페이지가 unstyled로 깨져 시각 검증이 무의미해진다.

```bash
scripts/dev-doctor.sh --restart   # CSS 200까지 확인, 깨졌으면 .next-dev 격리 재시작
```

`✓ dev 정상 (CSS 200)`이 나와야 진행한다. 안 나오면 멈추고 원인부터 본다(`docs/BROWSER_TESTING.md` 부록 T). dev-doctor는 외부 build와 `.next` 레이스가 감지되면 `--restart`로 dev를 `.next-dev`에 격리 재기동한다.

## 1. 플레이북 읽기

`docs/BROWSER_TESTING.md`의 환경 매트릭스(0장)와 그룹 A/B 시나리오를 읽는다. `.env` 키 설정 상태(Supabase/Anthropic/Polar)가 어디까지 검증 가능한지를 가른다.

## 2. dev-browser 사용 — 함정 내장

```bash
dev-browser --browser finsight --timeout 60 <<'EOF'
const page = await browser.getPage("landing");
const f404 = [];
page.on("response", (r) => { if (r.status() === 404) f404.push(r.url()); });
await page.goto("http://localhost:3000/", { waitUntil: "load" });   // networkidle 금지(HMR로 hang/detach)
await page.waitForTimeout(1000);
const styled = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
const shot = await saveScreenshot(await page.screenshot({ fullPage: true }), "landing.png");
console.log(JSON.stringify({ f404, styled, shot }, null, 2));
EOF
```

지켜야 할 규칙:
- **`waitUntil: "load"`** 사용. `networkidle`은 dev HMR 소켓 때문에 hang하거나 `frame was detached`로 죽는다.
- **404 수집** + computed style(`fontFamily`에 `pretendard` 포함 여부)로 styled 여부를 프로그램으로 판정.
- **파일 업로드**는 `setInputFiles`가 sandbox fs에 막힌다 → 브라우저 컨텍스트에서 `DataTransfer`로 주입:
  ```js
  await page.evaluate((csv) => {
    const dt = new DataTransfer();
    dt.items.add(new File([csv], "x.csv", { type: "text/csv" }));
    const i = document.querySelector('input[type="file"]');
    i.files = dt.files;
    i.dispatchEvent(new Event("change", { bubbles: true }));   // React onChange 트리거
  }, csvText);
  ```
- **API 응답 검증**은 화면 파싱 대신 JSON을 직접 캡처:
  ```js
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/analyze") && r.request().method() === "POST", { timeout: 60000 }),
    page.click('button[type="submit"]'),
  ]);
  const data = await resp.json();
  ```
- **스크린샷**은 `saveScreenshot(...)` 후 경로를 Read로 열어 육안 확인한다. 색/대비 이슈는 `getComputedStyle(el).color`와 `.backgroundColor`를 비교해 수치로 잡는다(예: CTA 텍스트가 배경과 동색이면 비가시).
- **반응형**은 `page.setViewportSize({width,height})`를 360/768/1440으로 돌리며 `document.documentElement.scrollWidth > window.innerWidth`로 가로 오버플로를 검사.

## 3. 실행 순서

1. **그룹 A**(키 불필요): 랜딩+샘플데모, CTA 동선, 대시보드 차단, OAuth 강등, API 401, 반응형.
2. **그룹 B**(로그인 이후): `.env`에 Supabase 키가 없으면 `docs/BROWSER_TESTING.md` 부록 F의 우회 픽스처(미들웨어 통과 + 데모 deps)를 **임시** 적용 → 테스트 후 `git checkout src/middleware.ts src/app/api/analyze/route.ts`로 원복.

## 4. 결과 기록

각 시나리오의 ✅/❌ + 스크린샷 경로를 `docs/BROWSER_TESTING.md`의 "실행 기록 템플릿"에 남긴다. 발견한 버그는 해당 시나리오에 `KNOWN ISSUE`로 메모해 다음 실행 때 혼동을 막는다.
