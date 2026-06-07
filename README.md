# resume-cli

여러 Ghostty 탭에 흩어진 `claude` / `vibe` 세션을 명령 하나로 스냅샷 떴다가, 재부팅
후 명령 하나로 탭째 되살려 resume 시키는 **macOS + Ghostty 전용** CLI.

- `save-cli` — 지금 떠 있는 모든 claude/vibe 세션을 스캔해 스냅샷(`~/.resume-cli/snapshot.json`)으로 저장.
- `restore-cli` — 스냅샷대로 Ghostty 새 탭을 N개 띄우고 각 탭에서 자동 resume.

## 요구 사항

- macOS
- **Ghostty 1.3 이상** (AppleScript 사전이 1.3에서 추가됨). 확인: `ghostty --version`.
- `claude` CLI, 그리고 vibe 세션을 쓴다면 `vibe` CLI가 PATH에 있어야 함.
- Node.js 18+

## 설치

```bash
cd ~/dev/resume-cli
npm link        # save-cli / restore-cli 를 전역 명령으로 등록
```

## 사용법

```bash
# 1) 현재 떠 있는 세션 스냅샷 저장 (재부팅/종료 전에 실행)
save-cli

# 2) 재부팅 후 — 먼저 무엇을 열지 확인 (실제로는 아무것도 안 열림)
restore-cli --dry-run

# 3) 실제 복원 — 세션 수만큼 Ghostty 새 탭이 열리고 각각 자동 resume
restore-cli
```

`--dry-run`(또는 `-n`)은 각 세션이 **어떤 cwd에서 어떤 명령으로** 복원되는지만
출력하고 탭은 열지 않습니다. 불안하면 항상 먼저 dry-run으로 확인하세요.

## 동작 방식 (안전성)

`restore-cli`는 **키 입력을 흉내 내지 않습니다.** 대신 Ghostty 1.3+의 AppleScript
사전을 통해 Ghostty를 직접 지목해 새 탭(또는 창)을 만들고, 그 탭의 작업 디렉터리와
실행 명령을 지정합니다.

> 이전 구현은 System Events로 Cmd+T와 명령어를 **글로벌 키보드에 타이핑**하는
> 방식이었는데, 그 순간 다른 앱이 맨 앞에 있으면 키 입력이 그 앱으로 새는 사고가
> 있었습니다. 현재 방식은 Ghostty만 직접 제어하므로 다른 앱으로 샐 수 없습니다.

각 탭은 복원 명령 뒤에 `; exec $SHELL`이 붙어, 명령이 끝나거나 세션이 종료돼도 탭이
닫히지 않고 인터랙티브 셸로 남습니다.

### 1회 자동화 권한 안내

`restore-cli`를 **처음 실행할 때** macOS가 "터미널/iTerm이 Ghostty를 제어하도록
허용하시겠습니까?" 팝업을 띄울 수 있습니다. **허용**을 누르면 됩니다.

- 이건 Apple Events(앱 간 제어) 권한이며, **손쉬운 사용(Accessibility)과는 무관**합니다.
- 한 번 허용하면 다시 묻지 않습니다.
- 나중에 바꾸려면: 시스템 설정 > 개인정보 보호 및 보안 > 자동화.

## 복원 명령 분기

- **plain claude** → `cd <cwd> && claude [보존된 플래그] --resume <id>`
  (예: 원래 세션이 `--dangerously-skip-permissions`로 떠 있었으면 그대로 보존)
- **vibe** → `vibe resume <projectName> --resume <id>`
  (vibe가 projectName으로 cwd를 스스로 찾고 페르소나(append-system-prompt)까지 복원)

## 스냅샷

- 위치: `~/.resume-cli/snapshot.json`
- save 시 전체 덮어쓰기(슬롯 1개). 외부 DB/네트워크 동기화 없음.

## PoC

탭 열기 메커니즘만 단독 검증:

```bash
npm run poc      # 또는: bash poc/ghostty-tab-poc.sh
```

`/tmp/resume-cli-poc.out`에 마커가 찍히면 성공입니다.
