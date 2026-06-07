# SUGGESTIONS

_vibe가 떠올린 개선 아이디어가 누적됩니다. 사용자가 검토 후 BLUEPRINT에 직접 반영 (§17)._

- fresh 세션 ID는 lsof로 열린 `.jsonl` 핸들을 못 잡는다(claude 2.1.x는 append 후 close). 대신 cwd 인코딩 폴더에서 mtime 최신 `.jsonl`로 ID를 잡는 방식으로 구현함 — 동작 검증됨.
- projects 인코딩 규칙: `/`뿐 아니라 `.`도 `-`로 치환됨 (예: com.apple.CloudDocs → com-apple-CloudDocs). 인코더에서 둘 다 처리.
- restore는 Ghostty.app에 Accessibility 권한이 필요(키스트로크 전송). 권한 미허용 시 osascript가 error 1002. restore-cli에 preflight 권한 체크를 넣어 친절히 안내하도록 함.
- 새 탭 키스트로크 타이밍: activate 후 0.4s, Cmd+T 후 셸 준비까지 0.8s delay가 필요했음(머신별로 조정 가능하게 env로 노출하면 좋음).
- claude --resume 세션은 원래 플래그(예: --dangerously-skip-permissions)를 cmdline에서 보존해 복원 명령에 재구성함.
