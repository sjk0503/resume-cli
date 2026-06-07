# BLUEPRINT — resume-cli

> 여러 Ghostty 탭에 흩어진 claude/vibe 세션을 명령 하나로 스냅샷 떴다가, 재부팅 후 명령 하나로 탭째 되살려 resume 시키는 macOS 전용 CLI.

## 1. 한 줄 요약
`save-cli`로 현재 떠 있는 모든 claude/vibe 세션을 스냅샷하고, `restore-cli`로 Ghostty 탭 N개를 다시 띄워 각 세션을 정확히 resume 한다. 로컬 전용, 배포 없음.

## 2. 문제 정의
사용자는 Ghostty 여러 탭에서 claude/vibe 세션을 동시에 돌린다. 노트북을 껐다 켤 때마다 세션을 이어가려면 각 세션ID를 수동 메모 → 재부팅 후 폴더마다 들어가 ID를 붙여넣어 resume 하는 노가다를 반복한다. resume-cli는 이 **수동 세션ID 추적·복원 노가다**를 제거한다.

## 3. 타겟 사용자
- **1차**: 사용자 본인 — macOS + Ghostty에서 여러 탭으로 claude/vibe를 병렬로 돌리는 개발자.
- **2차**: 없음. 범용화·공개 배포는 v1 목표가 아니다.

## 4. 핵심 원칙
1. **독립 standalone CLI** — vibe의 6번째 명령으로 붙이지 않는다. vibe와 별개 도구.
2. **순수 로컬** — 외부 서비스/네트워크/DB 없음. 스냅샷은 로컬 JSON 1개.
3. **탭 충실도면 충분** — 스플릿/배치/창 위치 복원은 하지 않는다. N개 세션이면 N개 탭.
4. **vibe 페르소나 보존** — vibe 세션은 `vibe resume`로 되살려 append-system-prompt(페르소나)까지 그대로 부활시킨다.
5. **macOS + Ghostty 전용** — 다른 OS/터미널은 v1 비대상.

## 5. 기능
**v1 (딱 2개)**
- `save-cli` — 떠 있는 모든 claude/vibe 세션을 스캔해 스냅샷 저장. 각 세션의 cwd, sessionId, kind(claude|vibe), vibe면 projectName 기록. 저장은 덮어쓰기.
- `restore-cli` — 스냅샷대로 Ghostty 탭 N개를 띄우고 각 탭에서 자동 resume.

**v2 이후 (제외)**
- 스플릿/창 배치 복원, 다중 스냅샷 슬롯, Ghostty 외 터미널, plain/vibe 외 세션 종류, 선택적 부분 복원.

## 6. 기술 스택
규모 `local-prototype` — PRESET(Next.js/Supabase 등) 미적용. 가벼운 로컬 CLI로 구성.
- **런타임/언어**: Node.js 확정 (vibe가 글로벌 npm 모듈이라 생태계 정합). 구현도 Node.js로 완료.
- **세션 탐지**: `ps aux`(프로세스+TTY 컬럼), `lsof`(cwd 추출). fresh 세션 ID는 lsof 열린 핸들로는 못 잡는다(claude 2.1.x는 append 후 close) → cwd 인코딩 폴더(`~/.claude/projects/<encoded-cwd>/`)에서 mtime 최신 `.jsonl` 파일명으로 ID를 잡는다. 인코딩은 `/`뿐 아니라 `.`도 `-`로 치환(예: `com.apple.CloudDocs` → `com-apple-CloudDocs`).
- **저장**: 로컬 JSON 파일. 외부 DB/동기화 없음.
- **탭 제어**: Ghostty 1.3+ AppleScript scripting dictionary. macOS에서 Ghostty CLI new-window/new-tab은 미지원, System Events 키스트로크 방식은 폐기(아래 §9). `osascript`로 Ghostty를 직접 지목해 탭 생성(아래 §8).

## 7. 세션 탐지·복원 설계 (관습과 다른 핵심부)
- **세션ID 추출 2경로**:
  - `--resume <id>`로 떠 있는 세션 → 명령줄에 ID가 박혀 있어 직접 파싱.
  - fresh 세션 → cwd는 `lsof -p <pid> -d cwd`로 얻고, 그 cwd를 인코딩한 `~/.claude/projects/<encoded-cwd>/` 폴더에서 mtime 최신 `.jsonl` 파일명을 session-id로 잡는다. (lsof로 열린 `.jsonl` 핸들은 못 잡는다 — claude 2.1.x가 append 후 close. 인코딩은 `/`·`.` 둘 다 `-`로 치환.)
- **kind 판별**: vibe 세션은 `--append-system-prompt`에 vibe 페르소나(CLAUDE.md — vibe / CEO)가 붙어 plain claude와 구분. 부모 프로세스가 vibe인지로도 판별 가능.
- **복원 명령**:
  - plain claude → 해당 cwd에서 `claude --resume <id>`.
  - vibe → `vibe resume <projectName> --resume <id>`. vibe가 projectName을 `~/dev/<name>/.vibe/state.json`으로 매핑해 cwd를 스스로 찾고 페르소나까지 복원.

## 8. 데이터 모델
- 스냅샷 1개: `~/.resume-cli/snapshot.json`.
- 형태: 세션 엔트리 배열. 각 엔트리 `{ cwd, sessionId, kind: "claude" | "vibe", vibeProjectName? }`.
- plain claude의 보존 플래그(예: `--dangerously-skip-permissions`)는 cmdline에서 추출해 함께 기록, 복원 명령에 재구성한다.
- `tty` 등 런타임 전용 필드는 탐지 중에만 쓰고 저장 시 제거한다(스냅샷에 영속화하지 않음).
- 동기화 불필요. save 시 전체 덮어쓰기.

## 9. 핵심 리스크
**Ghostty에서 코드로 새 탭을 열고 그 탭 안에서 특정 명령을 실행하기** — restore의 심장. **해소됨**: Ghostty 1.3+ AppleScript 사전으로 검증 완료(사용자 머신 Ghostty 1.3.1).
- **폐기된 경로**: ① Ghostty CLI new-window/new-tab — macOS 미지원. ② `osascript` + System Events 키스트로크(Cmd+T → 타이핑) — 글로벌 키보드를 가로채 맨 앞 다른 앱(Claude 데스크톱 등)으로 키 입력이 새는 **실사고**로 폐기.
- **채택된 경로**: Ghostty 1.3+ AppleScript scripting dictionary. `new surface configuration`에 `command`/`initial working directory`를 set한 뒤 `new tab in front window with configuration cfg`로 탭 생성. Ghostty를 직접 지목하므로 다른 앱으로 샐 위험을 원천 차단. 창이 0개면 `new window with configuration cfg`로 폴백(첫 세션만 창, 이후는 탭).
- **권한 모델**: Accessibility가 아니라 **Apple Events(자동화) 권한**. 첫 실행 시 "터미널이 Ghostty 제어 허용?" 1회 팝업.
- **잔여 항목**: 풀 라이브 복원(7세션 동시 resume)은 사용자가 재부팅 시나리오에서 직접 검증 예정.

## 10. 성공 지표
1. `save-cli` 한 번으로 떠 있는 claude/vibe 세션 전부가 스냅샷에 누락 없이 기록된다.
2. 재부팅 후 `restore-cli` 한 번으로 스냅샷의 N개 세션이 N개 탭으로 다시 뜬다.
3. 각 탭이 올바른 cwd에서 올바른 sessionId로 resume 된다 (수동 ID 입력 0회).
4. vibe 세션은 페르소나(append-system-prompt)까지 살아난 상태로 부활한다.
5. plain claude와 vibe 세션이 한 스냅샷에 섞여 있어도 각각 올바른 복원 명령으로 분기된다.
