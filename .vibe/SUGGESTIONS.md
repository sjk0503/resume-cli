# SUGGESTIONS

_vibe가 떠올린 개선 아이디어가 누적됩니다. 사용자가 검토 후 BLUEPRINT에 직접 반영 (§17)._

- fresh 세션 ID는 lsof로 열린 `.jsonl` 핸들을 못 잡는다(claude 2.1.x는 append 후 close). 대신 cwd 인코딩 폴더에서 mtime 최신 `.jsonl`로 ID를 잡는 방식으로 구현함 — 동작 검증됨.
- projects 인코딩 규칙: `/`뿐 아니라 `.`도 `-`로 치환됨 (예: com.apple.CloudDocs → com-apple-CloudDocs). 인코더에서 둘 다 처리.
- restore는 Ghostty.app에 Accessibility 권한이 필요(키스트로크 전송). 권한 미허용 시 osascript가 error 1002. restore-cli에 preflight 권한 체크를 넣어 친절히 안내하도록 함.
- 새 탭 키스트로크 타이밍: activate 후 0.4s, Cmd+T 후 셸 준비까지 0.8s delay가 필요했음(머신별로 조정 가능하게 env로 노출하면 좋음).
- claude --resume 세션은 원래 플래그(예: --dangerously-skip-permissions)를 cmdline에서 보존해 복원 명령에 재구성함.
- **[중요 정정] 키스트로크(System Events) 방식 전면 폐기.** Cmd+T + 명령어 타이핑은 글로벌 키보드를 가로채서, 맨 앞에 있던 다른 앱(Claude 데스크톱 앱 등)으로 키 입력이 새는 실사고가 발생했음. 위 7~8번 줄(Accessibility 권한·키스트로크 타이밍 delay)은 더 이상 유효하지 않음.
- **대체: Ghostty 1.3+ AppleScript 사전.** `new surface configuration` 만들어 `command`/`initial working directory`를 set하고 `new tab in front window with configuration cfg`로 탭 생성. Ghostty를 직접 지목하므로 다른 앱으로 샐 위험 원천 차단. 사용자 머신 Ghostty 1.3.1에서 실제 검증 완료.
- AppleScript 제약(검증됨): (1) `new tab`은 반드시 `in front window` 타깃 필요(bare는 -1708). (2) surface config는 인라인 record `{...}` 금지, `new surface configuration` 후 property set. (3) 창이 0개면 `new tab in front window` 실패 → `new window with configuration cfg` 폴백. 첫 세션만 창 폴백, 이후는 탭.
- 권한 모델 변경: 이제 **Accessibility가 아니라 Apple Events(자동화) 권한**. 첫 실행 시 "터미널이 Ghostty 제어 허용?" 1회 팝업. → BLUEPRINT §8 Plan B(System Events) 및 §9 Plan B 서술을 AppleScript 방식으로 갱신 권장.
- BLUEPRINT §8/§9는 "Ghostty CLI new-tab 우선, 미지원 시 System Events 폴백"으로 적혀 있으나, 실제로는 CLI new-tab이 macOS에서 미지원이고 AppleScript 사전이 정답이었음. §8 데이터모델·§9 리스크 항목 갱신 권장.
