# claude-code-sandbox

Progetto sandbox creato per esplorare le feature avanzate di Claude Code
(subagent, skills, hooks, worktree, cloud session, ecc.). Non è un progetto
di produzione: il codice in `src/` contiene bug intenzionali usati come
terreno di esercizio.

## Stack
TypeScript, Node.js test runner (`node --test`).

## Note
- `src/inventory.ts` ha un bug intenzionale noto (gestione quantity negative).
- `.claude/agents/reviewer.md` è un subagent di esempio.
- `.claude/skills/inventory-report/` è uno skill di esempio.
