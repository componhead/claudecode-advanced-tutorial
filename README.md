# claude-code-sandbox

Repository sandbox per esercitarsi con le feature avanzate di [Claude Code](https://claude.com/claude-code).

Vedi `TUTORIAL.md` per la guida dettagliata.

## Struttura

- `src/inventory.ts` — modulo TS con un bug intenzionale, utile per provare review/subagent.
- `.claude/agents/reviewer.md` — subagent custom di esempio.
- `.claude/skills/inventory-report/` — skill custom di esempio.
- `.claude/settings.json` — esempio di permessi granulari + hook `PostToolUse`.
