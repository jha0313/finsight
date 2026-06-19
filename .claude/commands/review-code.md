현재 변경분을 **차원별 병렬 서브에이전트**로 깊게 리뷰한다.

> 이 커맨드는 **Workflow 도구**를 사용하며 서브에이전트를 다수 소환한다(3 차원 리뷰 + 확정 후보당 3명 검증). 가벼운 리뷰는 `/review`를 써라.

인자(`$ARGUMENTS`)가 있으면 그 값을 리뷰 범위로 쓴다(예: `HEAD~3`, `main`). 없으면 기본 범위(`main...HEAD` + uncommitted)를 쓴다.

아래 순서를 **정확히** 따른다.

## 1. 입력 수집 (Workflow 호출 전, 직접 수행)

1. **변경 범위 결정 및 diff 수집**
   - 인자가 있으면 `git diff <인자>`, 없으면 `git diff main...HEAD`와 워킹트리 변경(`git diff HEAD`)을 합친다.
   - 변경 파일 목록: `git diff --name-only <범위>`.
   - diff가 비어 있으면 "리뷰할 변경 없음"을 출력하고 **즉시 종료**한다.
2. **PR 연결 여부 확인**
   - `gh pr view --json number,headRefOid` 시도. 성공하면 `prNumber`, `headSha`를 얻는다. 실패(연결 PR 없음)하면 `prNumber=null`로 둔다.
3. **가드레일 문서 읽기** — `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/ADR.md`를 읽어 하나의 텍스트(`repoDocs`)로 합친다. 토큰이 과하면 ARCHITECTURE/ADR은 핵심 규칙 위주로 요약한다.

## 2. Workflow 호출

```
Workflow({
  name: "review-code",
  args: { diff: <통합 diff>, files: <변경 파일 목록>, repoDocs: <가드레일 텍스트>, scope: <범위 문자열> }
})
```

반환값: `{ confirmed: [{ severity, file, line, title, tldr, good, fix, dimension, votes }], stats: { total, byDim, bySeverity } }`.
`confirmed`만 게시 대상이다(검증을 통과한 발견). 비어 있으면 판정은 **Approve**다.

## 3. 출력 생성 + 게시 (Workflow 반환 후, 직접 수행)

심각도 이모지: 🔴 critical · 🟠 major · 🟡 minor · ⚪ nit
**판정 규칙**: critical ≥ 1 → **Blocked** / (critical 0, major ≥ 1) → **Changes Requested** / 그 외 → **Approve**

### Layer 1 — 인라인 코멘트 (발견마다 1개, 4줄)

각 `confirmed` 발견을 아래 4줄 본문으로 만든다(`good`이 빈 문자열이면 그 줄 생략):

```
[🔴 critical] {title}
TL;DR: {tldr}
✓ Good: {good}
→ Fix: {fix}
```

### Layer 2 — PR 전체 요약 (1개)

`stats`로 집계해 아래 형식으로 만든다. Walkthrough는 diff를 보고 직접 2~3줄로 쓴다. **Critical/Major만** 나열하고 minor·nit은 인라인에만 남긴다.

```
## 판정: {Approve|Changes Requested|Blocked}
🔴 critical {n} · 🟠 major {n} · 🟡 minor {n} · ⚪ nit {n}   (검증 통과 {confirmed}/{raw})

**Walkthrough**
{변경 개요 2~3줄}

**잘된 점**
- {지켜진 핵심 규칙/좋은 패턴 1~2개}

**Critical / Major**
- 🔴 [{dimension}] {file}:{line} — {tldr}
- 🟠 [{dimension}] {file}:{line} — {tldr}

**다음 액션**
- 머지 전 반드시 → {critical/major 요약} / 권장 → {minor 요약}
```

### 게시

- **`prNumber`가 있으면**:
  - 인라인: 발견마다 `gh api repos/:owner/:repo/pulls/{prNumber}/comments -f commit_id={headSha} -f path={file} -F line={line} -f side=RIGHT -f body=<4줄 본문>`.
    - 422(해당 라인이 diff 범위 밖) 등으로 실패한 항목은 게시를 건너뛰고, 전체 요약 하단에 **"라인 외 발견"** 목록으로 모아 적는다.
  - 전체 요약: `gh pr comment {prNumber} --body <Layer 2 본문>` (마지막에 1개).
- **`prNumber`가 없으면**: 콘솔에 **전체 요약(Layer 2) → 인라인(파일:라인 순, Layer 1)** 순서로 마크다운 출력한다.

마지막으로 차원별 발견 수와 검증 통과율(`stats.byDim`)을 1줄로 요약한다.
