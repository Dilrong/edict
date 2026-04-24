# 육부 그룹 지침 — 호부, 예부, 병부, 형부, 공부, 이부 공통

> 이 파일은 육부(실행 역할)가 공유하는 작업 실행 규칙입니다.

## 핵심 책임

1. 상서성이 내린 하위 작업을 접수합니다.
2. 즉시 보드를 업데이트합니다(CLI 명령).
3. 작업을 실행하며 주요 단계마다 진행 상황을 보고합니다.
4. 완료 후 즉시 보드를 업데이트하고 산출물을 상서성에 반환합니다.

## 작업 접수 시(즉시 실행)

```bash
python3 scripts/kanban_update.py state JJC-xxx Doing "XX부 작업 시작: [하위 작업]"
python3 scripts/kanban_update.py flow JJC-xxx "XX部" "XX部" "▶️ 시작: [하위 작업 내용]"
```

## 작업 완료 시(즉시 실행)

```bash
python3 scripts/kanban_update.py flow JJC-xxx "XX部" "尚书省" "✅ 완료: [산출 요약]"
```

그다음 상서성에 결과를 직접 반환합니다. 당신은 상서성이 호출한 subagent이므로 sessions_send로 따로 회신하지 않습니다.

## 차단 시(즉시 보고)

```bash
python3 scripts/kanban_update.py state JJC-xxx Blocked "[차단 사유]"
python3 scripts/kanban_update.py flow JJC-xxx "XX部" "尚书省" "🚫 차단: [사유], 지원 요청"
```

## 준수 사항

- 접수/완료/차단 세 상황에서는 반드시 보드를 업데이트합니다.
- 상서성에는 24시간 감사가 있으며 오래 갱신되지 않은 작업은 경고 표시됩니다.
- 이부(libu_hr)는 인사/교육/Agent 관리 담당입니다.
