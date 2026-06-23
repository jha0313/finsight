#!/usr/bin/env python3
"""OWASP Top 10 2025 — deterministic pre-scan.

The cheap, high-precision half of the hybrid scan. It does NOT make verdicts;
it surfaces *signals* (dependency audit, hardcoded-secret patterns, per-category
lead-greps) plus honest coverage notes, then hands them to the LLM category
agents for judgement.

Design rules:
- stdlib only (Python 3.10+). No pip installs.
- Tools that are missing are skipped gracefully and recorded in `coverage_notes`
  so the report never overstates what was checked.
- Every detector is wrapped so one failure can't abort the whole scan.

Usage:
  python3 scan.py <repo-path> --json <out.json> [--scope "<label>"]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys

# Directories that never contain first-party source worth scanning.
SKIP_DIRS = {
    ".git", "node_modules", ".next", ".next-dev", "dist", "build", "out",
    "coverage", ".vercel", ".turbo", ".cache", "vendor", "__pycache__",
}
# Extensions / names that are noise (lockfiles, minified, binaries).
SKIP_NAME_SUFFIXES = (
    ".min.js", ".map", ".lock", "package-lock.json", "pnpm-lock.yaml",
    "yarn.lock", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico",
    ".woff", ".woff2", ".ttf", ".pdf", ".zip", ".gz",
)
MAX_FILE_BYTES = 512 * 1024          # skip files larger than this
MAX_HITS_PER_PATTERN = 40            # cap noisy patterns (logged, not silent)


def run(cmd, cwd, timeout=120):
    """Run a command, never raise. Returns (rc, stdout, stderr)."""
    try:
        p = subprocess.run(
            cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout,
        )
        return p.returncode, p.stdout, p.stderr
    except Exception as e:  # noqa: BLE001 — best-effort, must not crash scan
        return 1, "", str(e)


def tracked_files(repo):
    """Prefer git-tracked files; fall back to a filtered walk."""
    rc, out, _ = run(["git", "ls-files"], repo, timeout=30)
    paths = []
    if rc == 0 and out.strip():
        for rel in out.splitlines():
            rel = rel.strip()
            if not rel:
                continue
            parts = rel.split("/")
            if any(seg in SKIP_DIRS for seg in parts):
                continue
            if rel.endswith(SKIP_NAME_SUFFIXES):
                continue
            paths.append(rel)
        return paths
    # Fallback: walk
    for root, dirs, names in os.walk(repo):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for n in names:
            if n.endswith(SKIP_NAME_SUFFIXES):
                continue
            rel = os.path.relpath(os.path.join(root, n), repo)
            paths.append(rel)
    return paths


def read_text(path):
    try:
        if os.path.getsize(path) > MAX_FILE_BYTES:
            return None
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception:  # noqa: BLE001
        return None


def mask(value):
    """Show enough to recognise, hide the secret."""
    value = value.strip().strip("'\"")
    if len(value) <= 8:
        return value[:2] + "…"
    return value[:4] + "…" + value[-2:]


# ── Secret detectors (A02 Misconfiguration / A04 Cryptographic) ───────────────
# Each: (kind, compiled regex). Keep the set tight — precision over recall.
SECRET_PATTERNS = [
    ("anthropic_api_key", re.compile(r"sk-ant-[A-Za-z0-9_\-]{20,}")),
    ("openai_like_key", re.compile(r"\bsk-[A-Za-z0-9]{32,}\b")),
    ("aws_access_key_id", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("github_token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,}\b")),
    ("private_key_block", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----")),
    ("jwt_token", re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{6,}")),
    ("polar_token", re.compile(r"\bpolar_[a-z]{2,}_[A-Za-z0-9]{16,}")),
    ("generic_assignment", re.compile(
        r"""(?ix)
        \b(api[_-]?key|secret|client[_-]?secret|password|passwd|access[_-]?token|auth[_-]?token)
        \s*[:=]\s*
        (['"])([^'"\s${}]{8,})\2
        """)),
]
# Markers that mean "this is a reference/placeholder, not a real secret".
PLACEHOLDER_HINTS = re.compile(
    r"(process\.env|import\.meta\.env|\$\{|<[^>]+>|your[-_]|example|placeholder|"
    r"changeme|xxxx|\.\.\.|test[-_]?key|dummy|fake|sample|redacted)",
    re.IGNORECASE,
)


def scan_secrets(repo, files):
    findings = []
    for rel in files:
        # .env.example / docs are allowed to carry placeholders
        is_example = ".example" in rel or rel.endswith(".md")
        text = read_text(os.path.join(repo, rel))
        if text is None:
            continue
        for lineno, line in enumerate(text.splitlines(), start=1):
            if len(line) > 600:
                continue
            for kind, rx in SECRET_PATTERNS:
                m = rx.search(line)
                if not m:
                    continue
                matched = m.group(3) if kind == "generic_assignment" else m.group(0)
                env_ref = bool(PLACEHOLDER_HINTS.search(line)) or is_example
                findings.append({
                    "file": rel,
                    "line": lineno,
                    "kind": kind,
                    "preview": mask(matched),
                    "env_ref": env_ref,  # True = likely placeholder/env reference
                })
                break  # one hit per line is enough
    return findings


# ── Per-category lead-greps ───────────────────────────────────────────────────
# (regex, note). These are LEADS for the LLM agent, not findings. The agent must
# confirm or dismiss each against real semantics.
LEAD_PATTERNS = {
    "A01": [  # Broken Access Control
        (re.compile(r"\.getSession\("), "authz를 getSession()으로 판단하면 위반 — getUser()/getClaims() 검증인지 확인"),
        (re.compile(r"\bservice_role\b|SERVICE_ROLE"), "service_role 사용처 — 웹훅 모듈 한정 + import \"server-only\" 가드인지 확인"),
        (re.compile(r"customerExternalId"), "체크아웃 customerExternalId가 서버 세션 getUser().id로 강제되는지 확인(클라 입력 금지)"),
        (re.compile(r"(req|request)\.(body|headers)[^\n]{0,40}\btier\b", re.I), "요청 body/헤더의 tier를 신뢰하면 Pro 게이팅 우회 — 서버측 DB 구독상태로만 판정해야"),
    ],
    "A02": [  # Security Misconfiguration
        (re.compile(r"NEXT_PUBLIC_[A-Z0-9_]*(SECRET|KEY|TOKEN|SERVICE|PASSWORD|PRIVATE)"), "NEXT_PUBLIC_에 비밀 노출 의심 — 클라이언트 번들로 새어나감"),
        (re.compile(r"Access-Control-Allow-Origin[\"'\s:]+\*|origin:\s*['\"]\*['\"]"), "CORS 와일드카드 오리진"),
        (re.compile(r"dangerouslyAllowBrowser\s*:\s*true"), "SDK를 브라우저에 노출 — 키 유출 위험"),
        (re.compile(r"rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED"), "TLS 검증 비활성화"),
    ],
    "A04": [  # Cryptographic Failures
        (re.compile(r"createHash\(\s*['\"](md5|sha1)['\"]"), "약한 해시(md5/sha1) — 무결성/비밀번호 용도면 위반"),
        (re.compile(r"Math\.random\([^)]*\)[^\n]{0,40}(token|id|secret|nonce|otp)", re.I), "예측 가능한 난수를 보안 토큰에 사용 의심 — crypto 난수 필요"),
    ],
    "A05": [  # Injection
        (re.compile(r"dangerouslySetInnerHTML"), "XSS — 신뢰 불가 입력이 들어가는지 확인"),
        (re.compile(r"\beval\(|new Function\("), "동적 코드 실행 — 인젝션 위험"),
        (re.compile(r"child_process|execSync\(|\.exec\(|spawn\("), "커맨드 실행 — 사용자 입력이 인자로 들어가면 커맨드 인젝션"),
        (re.compile(r"(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)[^\n;]{0,80}\$\{", re.I), "문자열 보간으로 만든 SQL 의심 — 파라미터 바인딩 필요"),
    ],
    "A08": [  # Software or Data Integrity Failures
        (re.compile(r"validateEvent|constructEvent|verif(y|ied)Signature|webhookSecret|x-signature", re.I), "웹훅 서명검증 흔적(긍정 신호) — raw body 기준인지, 실패 시 거부하는지 확인"),
        (re.compile(r"req\.body|request\.json\(\)"), "웹훅 라우트라면: 파싱 전 raw body 서명검증 + event_id 멱등 선삽입인지 확인"),
    ],
    "A10": [  # Mishandling of Exceptional Conditions
        (re.compile(r"catch\s*\([^)]*\)\s*\{\s*\}"), "빈 catch — 예외 삼킴(부분 실패가 조용히 통과)"),
        (re.compile(r"(res|response)[^\n]{0,40}(err\.stack|error\.stack|err\.message|error\.message)", re.I), "에러 내부정보를 응답으로 노출 의심"),
        (re.compile(r"timeout|AbortController|maxDuration"), "타임아웃/취소 처리 흔적 — Opus 초과 시 규칙결과 보존 + AI는 unavailable 격리인지 확인(긍정 신호)"),
    ],
}


# Lead-grep targets first-party source only. Skipping these avoids matching the
# CRITICAL-rule *descriptions* that live in skill prompts / phase docs as text.
LEAD_SKIP_PREFIXES = (".claude/", "phases/", "docs/", "evals/", "node_modules/")
LEAD_EXTS = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".sql", ".sh")


def lead_grep(repo, files):
    leads = {cat: [] for cat in LEAD_PATTERNS}
    caps_hit = []
    counts = {cat: {} for cat in LEAD_PATTERNS}
    for rel in files:
        if rel.startswith(LEAD_SKIP_PREFIXES):
            continue
        if not rel.endswith(LEAD_EXTS):
            continue
        text = read_text(os.path.join(repo, rel))
        if text is None:
            continue
        lines = text.splitlines()
        for cat, patterns in LEAD_PATTERNS.items():
            for rx, note in patterns:
                key = rx.pattern[:24]
                for lineno, line in enumerate(lines, start=1):
                    if rx.search(line):
                        n = counts[cat].get(key, 0)
                        if n >= MAX_HITS_PER_PATTERN:
                            if (cat, key) not in caps_hit:
                                caps_hit.append((cat, key))
                            continue
                        counts[cat][key] = n + 1
                        leads[cat].append({
                            "file": rel,
                            "line": lineno,
                            "note": note,
                            "text": line.strip()[:200],
                        })
    cap_notes = [f"{cat} 패턴 '{key}…' 매치가 {MAX_HITS_PER_PATTERN}건 상한 도달 — 일부 미수록"
                 for cat, key in caps_hit]
    return leads, cap_notes


# ── Supply chain (A03) — npm audit ────────────────────────────────────────────
def npm_audit(repo):
    has_lock = os.path.exists(os.path.join(repo, "package-lock.json"))
    if not (has_lock and shutil.which("npm")):
        return {"ran": False, "reason": "package-lock.json 또는 npm 없음"}
    rc, out, err = run(["npm", "audit", "--json"], repo, timeout=180)
    if not out.strip():
        return {"ran": False, "reason": f"npm audit 출력 없음 (오프라인?): {err.strip()[:120]}"}
    try:
        data = json.loads(out)
    except json.JSONDecodeError:
        return {"ran": False, "reason": "npm audit JSON 파싱 실패(오프라인/레지스트리 오류 추정)"}
    meta = (data.get("metadata") or {}).get("vulnerabilities") or {}
    counts = {k: meta.get(k, 0) for k in ("critical", "high", "moderate", "low", "info")}
    counts["total"] = meta.get("total", sum(counts.values()))
    top = []
    for name, v in (data.get("vulnerabilities") or {}).items():
        sev = v.get("severity")
        if sev in ("critical", "high"):
            via = v.get("via") or []
            title = next((x.get("title") for x in via if isinstance(x, dict) and x.get("title")), "")
            top.append({"name": name, "severity": sev, "title": title})
    top.sort(key=lambda x: 0 if x["severity"] == "critical" else 1)
    return {"ran": True, "counts": counts, "top": top[:12]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("repo")
    ap.add_argument("--json", required=True, dest="out")
    ap.add_argument("--scope", default="full repository")
    args = ap.parse_args()

    repo = os.path.abspath(args.repo)
    if not os.path.isdir(repo):
        print(f"error: {repo} 디렉터리 없음", file=sys.stderr)
        sys.exit(2)

    tools = {
        "npm": bool(shutil.which("npm")),
        "git": bool(shutil.which("git")),
        "ripgrep": bool(shutil.which("rg")),
        "osv_scanner": bool(shutil.which("osv-scanner")),
        "gitleaks": bool(shutil.which("gitleaks")),
        "semgrep": bool(shutil.which("semgrep")),
    }
    coverage_notes = []
    if not tools["osv_scanner"]:
        coverage_notes.append("osv-scanner 미설치 → OS/언어 패키지 취약점 DB 교차조회 생략(npm audit만 사용)")
    if not tools["gitleaks"]:
        coverage_notes.append("gitleaks 미설치 → 시크릿은 작업트리 정규식 스캔만(git 히스토리 전수 미점검)")
    if not tools["semgrep"]:
        coverage_notes.append("semgrep 미설치 → 데이터플로우 기반 taint 분석 없음(패턴 grep + LLM 추론으로 대체)")

    rc, branch, _ = run(["git", "rev-parse", "--abbrev-ref", "HEAD"], repo, timeout=10)
    branch = branch.strip() if rc == 0 else "(unknown)"

    files = tracked_files(repo)

    # Each detector is isolated so one failure can't abort the scan.
    try:
        supply = npm_audit(repo)
    except Exception as e:  # noqa: BLE001
        supply = {"ran": False, "reason": f"내부 오류: {e}"}
    try:
        secrets = scan_secrets(repo, files)
    except Exception as e:  # noqa: BLE001
        secrets = []
        coverage_notes.append(f"시크릿 스캔 부분 실패: {e}")
    try:
        leads, cap_notes = lead_grep(repo, files)
        coverage_notes.extend(cap_notes)
    except Exception as e:  # noqa: BLE001
        leads = {cat: [] for cat in LEAD_PATTERNS}
        coverage_notes.append(f"lead-grep 부분 실패: {e}")

    real_secrets = [s for s in secrets if not s["env_ref"]]
    result = {
        "meta": {
            "repo": os.path.basename(repo.rstrip("/")),
            "repo_path": repo,
            "scope": args.scope,
            "branch": branch,
            "files_scanned": len(files),
        },
        "tools": tools,
        "coverage_notes": coverage_notes,
        "supply_chain": supply,
        "secrets": secrets,
        "leads": leads,
        "summary": {
            "secret_candidates": len(real_secrets),
            "secret_placeholders": len(secrets) - len(real_secrets),
            "lead_count": sum(len(v) for v in leads.values()),
            "audit_critical": supply.get("counts", {}).get("critical", 0) if supply.get("ran") else None,
            "audit_high": supply.get("counts", {}).get("high", 0) if supply.get("ran") else None,
        },
    }

    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    # Human-readable summary to stdout.
    s = result["summary"]
    print(f"# OWASP pre-scan · {result['meta']['repo']} ({result['meta']['scope']})")
    print(f"- files scanned: {result['meta']['files_scanned']}")
    if supply.get("ran"):
        c = supply["counts"]
        print(f"- npm audit (A03): critical {c['critical']} · high {c['high']} · moderate {c['moderate']} · low {c['low']}")
    else:
        print(f"- npm audit (A03): 미실행 — {supply.get('reason')}")
    print(f"- secret candidates: {s['secret_candidates']} (placeholders/env-ref 제외 {s['secret_placeholders']}건)")
    print(f"- category leads: {s['lead_count']}")
    if coverage_notes:
        print("- coverage gaps:")
        for n in coverage_notes:
            print(f"    · {n}")
    print(f"\nJSON → {args.out}")


if __name__ == "__main__":
    main()
