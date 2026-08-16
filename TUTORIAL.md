# Claude Code — Tutorial avanzato (bleeding-edge)

> Ambito: questo tutorial **non** copre le basi (editing file, slash command comuni tipo `/help`,
> concetti generali di prompt). È rivolto a chi già usa Claude Code quotidianamente e vuole
> spremere le funzionalità più recenti, meno documentate o in preview.
>
> Tutto quanto segue è stato verificato direttamente da `claude --help` (v2.1.233), dai
> sottocomandi reali (`mcp`, `plugin`, `agents`, `project`, `ultrareview`, `auto-mode`, `import`,
> `auth`), dagli strumenti realmente disponibili in questa sessione, e — per le sezioni 14-16,
> aggiunte in una seconda passata — dall'ispezione diretta delle stringhe del binario installato
> (`~/.local/share/mise/installs/claude/2.1.233/claude`). Non da documentazione a memoria. Dove
> un dettaglio non era verificabile con certezza, è segnalato esplicitamente invece di essere
> presentato come fatto.

---

## 1. Opzioni di avvio del CLI

`claude [options] [command] [prompt]` — avvia una sessione interattiva di default; `-p` per
uso non interattivo (scripting).

### 1.1 Controllo sessione

| Flag | Effetto |
|---|---|
| `-c`, `--continue` | Riprende la conversazione più recente nella directory corrente |
| `-r`, `--resume [id\|nome]` | Riprende per session ID, o apre il picker interattivo con ricerca |
| `-n`, `--name <nome>` | Nome visualizzato per la sessione (prompt box, picker `/resume`, titolo terminale) |
| `--fork-session` | Con `--resume`/`--continue`: crea un nuovo session ID invece di riusare l'originale |
| `--session-id <uuid>` | Usa uno specifico UUID come session ID |
| `--from-pr [numero\|url]` | Riprende la sessione collegata a una PR, o apre un picker filtrato |
| `--bg`, `--background` | Avvia come background agent e ritorna subito (gestione con `claude agents`) |
| `--cloud [descrizione\|id\|url]` | Crea (o si collega a) una **sessione cloud** su claude.ai/code |
| `--environment <ccpool_...>` | Crea una sessione cloud su un ambiente self-hosted specifico |
| `--teleport [sessione]` | Riprende localmente una sessione cloud/teleport |
| `--remote-control [nome]` | Avvia con **Remote Control**: la sessione diventa raggiungibile da telefono/altra macchina |
| `-w`, `--worktree [nome]` | Crea/entra in un git worktree isolato per la sessione (v. §4) |
| `--tmux[=classic]` | Crea una sessione tmux per il worktree (richiede `--worktree`); usa pannelli nativi iTerm2 quando disponibili |

Cosa **non** viene ripristinato automaticamente al resume: `--mcp-config`, `--settings`,
`--add-dir`, `--plugin-dir` — vanno ripassati esplicitamente. `settings.json` invece viene
riletto ad ogni avvio.

### 1.2 Modello ed effort

```bash
claude --model sonnet      # alias per l'ultimo Sonnet (oggi: claude-sonnet-5)
claude --model opus        # alias per l'ultimo Opus (oggi: claude-opus-5)
claude --model fable       # alias per l'ultimo Fable (oggi: claude-fable-5)
claude --model claude-haiku-4-5-20251001   # nome completo, per pinnare la versione
claude --effort high       # low | medium | high | xhigh | max
claude --fallback-model sonnet,haiku   # solo con --print: catena di fallback su overload,
                                        # ritenta il primario a ogni nuovo turno utente
```

Nota: `fast mode` (toggle `/fast`, disponibile su Opus) non è un flag di avvio ma un comando
in-sessione — usa Opus con output più rapido, non un modello "più piccolo".

### 1.3 System prompt e tool

```bash
--system-prompt "<testo>"           # sostituisce l'intero system prompt
--append-system-prompt "<testo>"    # lo estende
--tools "Bash,Edit,Read"            # whitelist assoluta dei tool disponibili ("" = nessuno, "default" = tutti)
--allowedTools "Bash(git *)" Edit   # tool/pattern permessi senza prompt
--disallowedTools "Bash(rm *)"      # tool/pattern negati
```

### 1.4 Permessi (v. anche §2)

```bash
--permission-mode <acceptEdits|auto|bypassPermissions|manual|dontAsk|plan>
--dangerously-skip-permissions            # bypassa tutti i controlli
--allow-dangerously-skip-permissions      # rende disponibile il bypass (Shift+Tab) senza attivarlo di default
```

### 1.5 Scripting e output strutturato (con `--print`)

```bash
--output-format text|json|stream-json   # ATTENZIONE: con -p, "stream-json" richiede --verbose
                                         # (verificato dal vivo: senza, errore secco "Error: When
                                         # using --print, --output-format=stream-json requires
                                         # --verbose" — non richiesto invece per --output-format json)
--input-format text|stream-json
--include-partial-messages     # chunk parziali nello stream (richiede stream-json)
--include-hook-events          # eventi hook nello stream (richiede stream-json)
--forward-subagent-text        # inoltra testo/thinking dei subagent come messaggi con parent_tool_use_id
--replay-user-messages         # riemette i messaggi utente in input su stdout, per conferma
--json-schema '{...}'          # forza output strutturato validato contro uno JSON Schema
--max-budget-usd 2.50          # tetto di spesa per la chiamata; esce se superato
--no-session-persistence       # non salvare la sessione su disco (non riprendibile)
--prompt-suggestions           # emette un prompt_suggestion dopo ogni turno (prossima mossa prevista)
```

Questo è il set di flag che rende Claude Code un building-block per pipeline: `stream-json`
in/out + `--replay-user-messages` + `--forward-subagent-text` bastano per costruire una UI
custom sopra il CLI senza reimplementare il protocollo agentic.

### 1.5.1 Cosa c'è davvero nel primo evento `stream-json` (verificato dal vivo)

Lanciando `claude -p "..." --output-format stream-json --include-hook-events` in questo
sandbox, il primissimo evento è `{"type":"system","subtype":"init", ...}` e contiene molto più
di quanto documentato altrove — utile per chi costruisce tooling sopra il CLI:

- **`tools`**: la lista esatta dei tool nativi disponibili in QUESTA sessione (in questo run:
  `Task, Bash, CronCreate, CronDelete, CronList, DesignSync, Edit, EnterWorktree, ExitWorktree,
  ListAgents, Monitor, NotebookEdit, PushNotification, Read, RemoteTrigger, ReportFindings,
  ScheduleWakeup, SendMessage, Skill, TaskOutput, TaskStop, ToolSearch, WebFetch, WebSearch,
  Write`) — conferma diretta che `CronCreate`/`DesignSync`/`EnterWorktree`/`Monitor`/
  `RemoteTrigger`/`ScheduleWakeup`/`SendMessage` (§4, §10, §13, §16) sono tool standard del
  prodotto, non qualcosa di specifico a un singolo ambiente.
- **`slash_commands`**: elenco completo dei comandi disponibili. Oltre a quelli già coperti in
  questo tutorial, sono comparsi parecchi comandi non ancora documentati qui:
  `/verify`, `/debug`, `/batch`, `/autocompact`, `/clear`, `/compact`, `/config`, `/context`,
  `/effort`, `/heapdump`, `/reload-skills`, `/usage`, `/usage-credits`, `/extra-usage`,
  `/insights`, `/recap`, `/goal`, `/design`, `/design-consent`, `/design-revoke`,
  `/list-agents`, `/team-onboarding`, `/auto-mode-setup`. Alcuni si spiegano da soli
  (`/usage*` → introspezione consumo/costi, coerente con `--max-budget-usd`; `/context` →
  quanto contesto è occupato, citato in §17 sotto altro nome; `/heapdump` → diagnostica interna
  del processo Claude Code stesso). Non li documento singolarmente qui perché non ne ho ancora
  verificato il comportamento reale — ma sapere che esistono è già utile: `/<nome> --help` (o
  semplicemente provarli) è il modo più veloce per scoprirli da soli.
- **`agents`** e **`skills`**: confermano che gli agent/skill custom del progetto (`reviewer`,
  `inventory-report`) sono stati caricati correttamente insieme a quelli di sistema
  (`claude, Explore, general-purpose, Plan, statusline-setup`).
- **`capabilities`**: `interrupt_receipt_v1`, `interrupt_cancel_queued_v1`, `msg_lifecycle_v1`
  — il protocollo stream-json supporta l'**interruzione a metà turno** e la **cancellazione di
  messaggi già in coda** da parte del chiamante: rilevante se stai pilotando una sessione `-p
  --input-format stream-json` da un tuo processo e vuoi poter annullare un turno in corso.
- **`memory_paths.auto`**: il path reale della memoria auto-persistente per questo progetto (v.
  §9) — conferma empirica della convenzione descritta lì.
- **`messaging_socket_path`**: un socket Unix locale (es. `/run/user/1000/cc-socks/<pid>.sock`)
  — il meccanismo con cui `SendMessage`/cross-session (§4) comunica realmente tra processi
  Claude Code sulla stessa macchina.

Il flusso poi prosegue con eventi `rate_limit_event` (stato della finestra di rate limit —
in questo run: `rateLimitType: "five_hour"`, più i campi `overageStatus`/`isUsingOverage` per
capire se stai consumando overage a pagamento) e `thinking_tokens` (budget di thinking stimato,
aggiornato in tempo reale mentre il modello ragiona, prima ancora del token di output finale).
Nessuno di questi due è nella mia lista di flag documentati in §1.5 — li ho scoperti solo
guardando lo stream vero.

**Interruzione a metà turno, vista dal vivo**: premendo Ctrl-C durante un `-p --output-format
stream-json` (prima che arrivasse a un `tool_use`), è comparso un messaggio `user` con testo
`"[Request interrupted by user]"`, seguito dal `result` finale con `is_error: true`,
`terminal_reason: "aborted_streaming"`, `subtype: "error_during_execution"`, e un `errors[]`
con un diagnostic interno (`[ede_diagnostic] result_type=user last_content_type=n/a
stop_reason=null`). Dettaglio da tenere a mente per chi fa scripting: la chiamata leggera ad
Haiku (§1.5.1 sopra) era già partita ed è stata comunque fatturata (pochi decimi di centesimo)
anche se il turno non ha prodotto risultato — un'interruzione non è sempre gratis.

### 1.6 Prestazioni e prompt cache

```bash
--autocompact <auto|100k..1M>                    # soglia di context compaction
--exclude-dynamic-system-prompt-sections          # sposta cwd/env/git-status dal system prompt
                                                   # al primo messaggio utente → migliora il riuso
                                                   # della prompt cache TRA UTENTI DIVERSI (stesso
                                                   # system prompt statico). Utile in CI/gateway condivisi.
```

### 1.7 MCP, plugin, directory

```bash
--mcp-config ./mcp.json [altro.json ...]   # carica MCP server da file/stringhe JSON
--strict-mcp-config                        # usa SOLO i server passati con --mcp-config
--plugin-dir ./my-plugin [...]             # carica un plugin da directory/zip, solo per questa sessione
--plugin-url https://.../plugin.zip
--add-dir ../altro-progetto                # estende l'accesso tool ad altre directory
--setting-sources user,project,local       # quali livelli di settings caricare
--settings ./file.json                     # settings aggiuntivi da file o stringa JSON
```

### 1.8 Debug, sicurezza, ambienti ristretti

```bash
--bare              # skip hook/LSP/plugin-sync/attribution/auto-memory/prefetch/keychain;
                     # imposta CLAUDE_CODE_SIMPLE=1; auth solo via ANTHROPIC_API_KEY/apiKeyHelper
--safe-mode          # disabilita CLAUDE.md, skill, plugin, hook, MCP, custom agent/comandi,
                      # output style, keybinding — utile per isolare una config rotta;
                      # imposta CLAUDE_CODE_SAFE_MODE=1. I settings gestiti (org) restano attivi.
-d, --debug [filtro]  # es. "api,hooks" oppure "!1p,!file" per escludere categorie
--debug-file <path>
--betas <header...>   # beta header API (solo utenti con API key)
--ax-screen-reader     # output flat, senza bordi/animazioni decorative
```

`--bare` e `--safe-mode` sono la coppia da conoscere per il troubleshooting: `--safe-mode`
isola "è la mia config o è Claude Code?", `--bare` è la modalità minimale per script/CI dove
non vuoi nessuna auto-discovery.

### 1.9 Sottocomandi (verificati)

| Comando | Cosa fa |
|---|---|
| `claude agents` | Gestisce i background agent. `--json` stampa le sessioni attive come array JSON (per scripting, non richiede TTY). `--all` include anche quelle completate. `--cwd <path>` filtra per directory |
| `claude auth login/logout/status` | Gestione autenticazione |
| `claude auto-mode config/defaults/critique/reset` | Vedi §2.3 |
| `claude doctor` | Diagnostica l'installazione; legge i settings della cwd senza trust prompt |
| `claude gateway` | Gateway enterprise auth/telemetria |
| `claude import <codex\|gemini>` | Importa la configurazione da un altro coding agent (`--dry-run` per anteprima) |
| `claude install <stable\|latest\|versione>` | Installa/reinstalla il binario nativo |
| `claude mcp ...` | Gestione MCP server (v. §7) |
| `claude plugin ...` | Gestione plugin (v. §8) |
| `claude project purge [path]` | Cancella tutto lo stato locale di un progetto (transcript, task, file history, entry di config) |
| `claude setup-token` | Genera un token di lunga durata (richiede subscription) |
| `claude ultrareview [target]` | Code review cloud multi-agente sul branch corrente (o PR/branch base) — v. §11 |
| `claude update`/`upgrade` | Controlla e installa aggiornamenti |

---

## 2. Permessi granulari e classificatore auto-mode

### 2.1 Le sei modalità

`acceptEdits`, `auto`, `bypassPermissions`, `manual`, `dontAsk`, `plan`. `auto` è la modalità
"intelligente": un classificatore leggero decide caso per caso se un'azione è abbastanza
sicura da eseguire senza chiedere, sulla base di regole allow/soft_deny/hard_deny.

### 2.2 Regole granulari in `.claude/settings.json`

Esempio reale usato nel progetto sandbox (`.claude/settings.json`):

```json
{
  "permissions": {
    "allow": ["Read", "Grep", "Glob", "Edit(src/**)", "Bash(npm run lint)", "Bash(npm test)"],
    "ask": ["Bash(git push*)", "Bash(git commit*)"],
    "deny": ["Bash(rm -rf*)"]
  }
}
```

I pattern `Tool(pattern)` funzionano sia per `Bash` (match sul comando) sia per `Edit`/`Read`
(match sul path, glob-style).

### 2.2.1 Gotcha verificato dal vivo: `permissions.allow` viene ignorato senza trust

Lanciando `claude -p "..." --output-format json` in questo stesso progetto sandbox (prima di
aver mai avviato una sessione interattiva qui), l'output ha incluso questo warning:

```
Ignoring 7 permissions.allow entries from .claude/settings.json: this workspace has not been
trusted. Run Claude Code interactively here once and accept the trust dialog, or set
projects["<path>"].hasTrustDialogAccepted: true in ~/.claude.json.
```

`settings.json` viene comunque letto, ma la lista `permissions.allow` è **ignorata** finché il
workspace non è stato "trusted" — gate di sicurezza contro un `.claude/settings.json` malevolo
in un repo appena clonato che si auto-concede permessi larghi senza approvazione umana. In `-p`
(niente TTY) il dialog di trust non può comparire, quindi il gate resta bloccato: in CI/scripting
questo si traduce in permessi più stretti del previsto finché non fai il trust una volta in modo
interattivo o non imposti `hasTrustDialogAccepted: true` a mano in `~/.claude.json`.

Dettaglio rilevante per chi usa la convenzione bare-repo + worktree (come questo progetto): il
path tracciato nel warning è quello del **repo bare** (`.../claude-code-sandbox/.bare`), non del
worktree (`WORKING/`) — il trust è per-repository, non per-worktree.

### 2.2.2 Gotcha verificato dal vivo: comandi composti e modalità headless

Chiedendo a Claude, in `-p`, di verificare le sue modifiche con `npm run build` (**non** in
`permissions.allow`, solo `npm run lint`/`npm test` lo sono), ho osservato tre tentativi, tutti
negati:

1. `npm run build 2>&1 | tail -30 && npm test 2>&1 | tail -40` → negato con motivo
   `decision_reason_type: "subcommandResults"`, messaggio *"This Bash command contains multiple
   operations. The following part requires approval: npm run build 2>&1"* — il piping/`&&`
   viene scomposto e valutato pezzo per pezzo, non come stringa unica.
2. `npm run build 2>&1 | tail -30` → stesso esito.
3. `npm run build` nudo → negato con `decision_reason_type: "other"`, messaggio diretto
   *"This command requires approval"*.

Punto chiave per chi fa scripting: in `-p` (niente TTY) un comando che richiederebbe conferma
interattiva **non genera un prompt** — viene auto-rifiutato (`tool_result_meta.non_execution_kind:
"user-rejected"`, anche se nessun umano ha davvero rifiutato nulla). Claude, dopo il terzo
tentativo, ha smesso di insistere e ha chiuso il turno con `stop_reason: "end_turn"` chiedendo
conferma nel testo del risultato finale, invece di restare bloccato o consumare altri turni.
L'oggetto `result` finale porta anche `permission_denials[]`: un log strutturato di ogni tool
call bloccata nel turno (nome tool, input esatto) — comodo per un audit programmatico senza
dover fare parsing dello stream intero.

### 2.3 `claude auto-mode` — feature poco nota

```bash
claude auto-mode config      # config effettiva (tue impostazioni + default) come JSON
claude auto-mode defaults    # stampa le regole di default (environment/allow/soft_deny/hard_deny)
claude auto-mode critique    # chiede un feedback AI sulle TUE regole custom, prima di affidartici
claude auto-mode reset       # rimuove la sezione autoMode dai settings utente, torna ai default
```

`auto-mode critique` è particolarmente utile prima di attivare `--permission-mode auto` in un
repository sensibile: fa revisionare a Claude le tue regole custom per individuare falsi
negativi (azioni pericolose classificate come sicure).

---

## 3. Worktree nativi

`--worktree [nome]` non è solo uno shortcut a `git worktree add`: integra la sessione nel
worktree creato. Comportamento (governato da `worktree.baseRef` in settings, default `fresh`):
branch da `origin/<default-branch>` (stato pulito); con `head` invece parte dal tuo HEAD locale
(mantiene i commit non pushati).

All'interno della sessione hai anche i tool `EnterWorktree`/`ExitWorktree` (usati solo su
richiesta esplicita, non proattivamente): `EnterWorktree` crea un worktree sotto
`.claude/worktrees/` e ci sposta la working directory della sessione; `ExitWorktree` la
riporta indietro, con `keep` (lascia branch e directory) o `remove` (cancella — richiede
`discard_changes: true` se ci sono modifiche non salvate).

`--tmux` abbina il worktree a una sessione tmux dedicata (pannelli nativi iTerm2 se
disponibile), utile per lavorare su più worktree in parallelo senza perdere l'orientamento.

> Nota sul progetto sandbox: qui ho usato la convenzione bare-repo + worktree di
> `klone.fish` (`.bare/` + worktree `WORKING/`) invece di `--worktree`, perché il repo è
> stato creato da zero e non da un URL remoto — la struttura risultante è comunque
> compatibile con `--worktree`/`EnterWorktree` per lavori futuri.

---

## 4. Background agent, monitor, multi-sessione

### 4.1 Background agent

```bash
claude --bg "esegui la suite di test e riportami solo i falliti"
claude agents               # vista interattiva delle sessioni attive/background
claude agents --json --all  # scripting: JSON di tutte le sessioni (attive + completate)
```

### 4.2 Dentro la sessione: subagent, fork, monitor

- **Subagent** (tool `Agent`): delega un task a un agente. Con `subagent_type: "fork"` l'agente
  **eredita tutta la conversazione corrente** (contesto, cache dei prompt condivisa) e gira in
  background senza inquinare il contesto principale con l'output intermedio — ideale per
  ricerche o task multi-step il cui output grezzo non serve più dopo la sintesi. Con qualunque
  altro `subagent_type` (o omesso) parte un agente **a freddo**: nessuna memoria della
  conversazione, va istruito come un collega che entra ora nella stanza.
  `isolation: "worktree"` fa girare il subagent in un worktree git isolato (auto-cleanup se non
  produce modifiche); `isolation: "remote"` lo fa girare in un ambiente cloud.

- **Monitor**: avvia un watcher in background che trasforma ogni riga di stdout di uno script
  in una notifica (`tail -f`, `inotifywait -m`, polling di una API...). Utile per "avvisami ogni
  volta che compare un ERROR nel log" — diverso da un task in background one-shot (per quello
  basta `Bash` con `run_in_background`).

- **Cross-session** (`SendMessage` / `ListAgents`): un agente può inviare messaggi ad altri
  agenti — subagent locali, altre sessioni Claude Code sulla stessa macchina, sessioni cloud,
  o (con Remote Control attivo) sessioni su un'altra macchina. `ListAgents` elenca i target
  raggiungibili; l'indirizzo è semplicemente il nome dell'agente.

- **Remote Control** (`--remote-control [nome]`): rende la sessione CLI raggiungibile da
  telefono/altra postazione. Con Remote Control connesso, le notifiche push (tool
  `PushNotification`) arrivano anche sul telefono, non solo come notifica desktop.

---

## 5. Skill personalizzate

Le skill sono istruzioni "impacchettate" auto-invocabili. Struttura minima:

```markdown
---
name: inventory-report
description: Genera un report testuale del valore di inventario. Usa quando l'utente
  chiede un "report inventario" o "valore magazzino".
---

Istruzioni per l'agente...
```

Vedi `.claude/skills/inventory-report/SKILL.md` nel progetto sandbox. Claude decide
autonomamente quando invocarla in base alla `description` — per questo la description deve
essere scritta pensando a "quando" e non solo a "cosa fa". Le skill si possono anche invocare
esplicitamente con `/nome-skill`.

Feature bleeding-edge collegata: `claude plugin eval` (v. §8) permette di scrivere test case
automatizzati (prompt + grader) anche per le skill impacchettate in un plugin, con un arm di
baseline "senza plugin" per misurare l'impatto reale.

---

## 6. Hook — automazione event-driven

Configurabili in `settings.json` sotto `"hooks"`. Eventi **verificati e stabili**: `PreToolUse`,
`PostToolUse`, `UserPromptSubmit`, `Stop`, `SubagentStop`, `Notification`, `PreCompact`,
`SessionStart`, `SessionEnd`. Esistono altri eventi di lifecycle più granulari nelle versioni
recenti (per-tool-batch, worktree, compaction dettagliata): usa `--include-hook-events` con
`--output-format stream-json` per osservarli live invece di fidarti di un elenco statico, dato
che questa è l'area che cambia più rapidamente tra versioni.

Esempio già presente nel progetto sandbox (`.claude/settings.json`):

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [{ "type": "command", "command": "npx --package=typescript tsc --noEmit -p . || true" }]
      }
    ]
  }
}
```

Il tipo `"command"` (script di shell, riceve JSON su stdin, exit code 2 = blocco) è quello
consolidato. Versioni recenti espongono anche hook che delegano la decisione a un servizio
HTTP o a un giudice LLM leggero: se ti servono, verifica la sintassi esatta nella versione
installata (`claude doctor`, o prova in `--debug hooks`) prima di affidarci logica critica.

### 6.1 Struttura reale degli eventi hook in `stream-json` (verificata dal vivo)

Con `--include-hook-events`, ogni esecuzione di un hook produce tre eventi in sequenza, non uno
solo — visti letteralmente in questo sandbox mentre l'hook `PostToolUse` sull'`Edit` di
`inventory.ts` scattava:

```json
{"type":"system","subtype":"hook_started","hook_id":"...","hook_name":"PostToolUse:Edit","hook_event":"PostToolUse"}
{"type":"system","subtype":"hook_progress","hook_id":"...","hook_name":"PostToolUse:Edit","stdout":"...","stderr":"..."}
{"type":"system","subtype":"hook_response","hook_id":"...","hook_name":"PostToolUse:Edit","exit_code":0,"outcome":"success","output":"..."}
```

Da notare: `hook_name` è nel formato `"<HookEvent>:<Matcher>"` (qui `PostToolUse:Edit`);
`hook_progress` può comparire più volte (stdout/stderr man mano che arrivano, utile per hook
lenti); `hook_response` porta `exit_code` e un `outcome` (`"success"` in questo caso) oltre
all'output completo. Questo è il modo giusto per debuggare un hook che sembra non fare nulla:
guarda `hook_response.output`, non solo se la sessione è andata a buon fine.

### 6.2 Gotcha reale colto sul fatto: `npx <tool>` senza il pacchetto installato risolve a caso

Nel run che ha generato l'esempio sopra, l'hook originale (`npx tsc --noEmit -p .`) è "riuscito"
(`exit_code: 0`) ma **non ha verificato nulla**: non essendoci `typescript` tra le dipendenze
installate (nessun `node_modules` in questo sandbox), `npx tsc` non ha capito "voglio il
TypeScript compiler" — è andato sul registry npm e ha eseguito un pacchetto che si chiama
letteralmente `tsc` (deprecato, stampa solo un avviso: *"This is not the tsc command you are
looking for"*). Il `|| true` che uso per non bloccare il flusso in caso di errore ha
mascherato completamente il problema: l'hook sembrava verde ma non testava niente.

Fix applicato (già nel `.claude/settings.json` di questo progetto): `npx --package=typescript
tsc --noEmit -p .` — forzando npx a risolvere `tsc` specificamente dal pacchetto `typescript`,
non per nome-comando. Vale come regola generale per qualunque hook basato su `npx <binario>`:
se il binario non è garantito come dipendenza locale già installata, usa sempre `--package=<nome
pacchetto reale>` per evitare di eseguire silenziosamente qualcos'altro.

### 6.3 Secondo gotcha, lo stesso giorno: `|| true` maschera anche gli errori *veri*

Dopo il fix sopra, l'hook ha finalmente lanciato il vero `tsc` — che però ha trovato due errori
reali (`node:test`/`node:assert/strict` non riconosciuti, mancava `@types/node` nel progetto).
Risultato in `hook_response`: **`exit_code: 0`, `outcome: "success"`** comunque, perché il mio
`|| true` inghiotte qualsiasi exit code, non solo quello del "pacchetto sbagliato" — inclusi
errori di compilazione legittimi. Lezione più generale: se costruisci automazione sopra
`--include-hook-events` che decide in base a `exit_code`/`outcome`, un hook con `|| true` in
coda è **sempre "verde"** a prescindere da cosa sia successo davvero — devi fare parsing del
campo `output` (testo) per sapere se l'hook ha effettivamente trovato qualcosa. Il gap reale
(`@types/node` mancante) è stato comunque sistemato in questo progetto — non era più solo un
esempio didattico, era un bug vero nel sandbox.

**Aggiornamento verificato**: ispezionando direttamente il binario installato (v2.1.233,
`~/.local/share/mise/installs/claude/2.1.233/claude`) ho trovato conferma esplicita anche di
`WorktreeCreate` e `WorktreeRemove` come eventi hook reali — sono la via con cui `EnterWorktree`
delega la creazione/rimozione del worktree quando la sessione **non** gira dentro un repository
git (isolamento VCS-agnostico). Non è documentazione a memoria: è il nome letterale trovato
nelle stringhe del binario, incrociato con la descrizione dello strumento `EnterWorktree`
disponibile in questa sessione.

---

## 7. MCP server

```bash
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
claude mcp add --transport http corridor https://app.corridor.dev/api/mcp \
  --header "Authorization: Bearer ..."
claude mcp add my-server -e API_KEY=xxx -- npx my-mcp-server     # stdio, con env var
claude mcp add-json my-server '{...}'                            # stdio o SSE via JSON
claude mcp login my-server      # OAuth per server HTTP/SSE/connector claude.ai
claude mcp logout my-server
claude mcp list                 # server .mcp.json non approvati compaiono come "⏸ Pending approval"
claude mcp get my-server        # health-check se approvato
claude mcp serve                # espone Claude Code stesso come MCP server
```

Trasporti confermati: `http`, `stdio` (via `-- comando`), `SSE`. `.mcp.json` a livello di
progetto richiede approvazione esplicita per ogni server prima di essere effettivamente
connesso — non basta che sia nel file.

`claude mcp serve` è la feature meno ovvia: espone la sessione Claude Code corrente come
server MCP, quindi puoi far parlare un altro agente (o un'altra istanza di Claude) CON Claude
Code stesso attraverso il protocollo MCP.

### 7.1 Resync del tool-set MCP a runtime

Confermato dal binario installato: esistono due tool interni, `WaitForMcpServers` e
`RefreshMcpTools`, usati automaticamente dall'agente quando serve. Il primo aspetta che i
server MCP ancora in fase di connessione finiscano l'handshake prima di usarne i tool (utile
se un server è lento a partire e il primo turno lo richiederebbe subito). Il secondo
ri-interroga i server già connessi e aggiorna la lista di tool disponibili quando la
notifica nativa "tool-list-changed" del protocollo MCP viene persa (hiccup di connessione,
server che annuncia mentre lo stream di notifiche era giù). Non sono comandi che lanci tu:
è comportamento automatico di resilienza, ma spiega perché a volte un tool MCP appena
aggiunto lato server compare nella sessione senza bisogno di riavviarla.

---

## 8. Plugin

### 8.1 Ciclo di vita

```bash
claude plugin init my-plugin        # scaffolda in ~/.claude/skills/my-plugin/
                                     # (si auto-carica come my-plugin@skills-dir dalla prossima sessione)
claude plugin validate ./my-plugin  # valida manifest + skill/agent/comandi
claude plugin install nome[@marketplace]
claude plugin list
claude plugin enable/disable nome
claude plugin details nome          # inventario componenti + COSTO IN TOKEN PROIETTATO
claude plugin update nome           # richiede restart per applicare
claude plugin uninstall nome
claude plugin prune                 # rimuove dipendenze auto-installate non più usate
claude plugin tag ./path            # crea tag git {name}--v{version}, valida coerenza plugin.json/marketplace
claude plugin marketplace ...       # gestione marketplace
```

`claude plugin details` è particolarmente utile prima di abilitare un plugin di terze parti in
un progetto con budget di context stretto: ti dice quanto costerà in token prima di attivarlo.

### 8.2 Eval dei plugin (`claude plugin eval`) — feature molto recente

```bash
claude plugin eval init          # crea interattivamente una suite in evals/
claude plugin eval ./my-plugin   # esegue evals/**/case.yaml oppure evals/**/prompt.md + graders/*.md
```

Il target può essere un path, un nome plugin, o un id `plugin@marketplace` (sia plugin
installati sia quelli in `skills-dir` risolvono); l'esecuzione aggiunge automaticamente un
"braccio" di baseline **senza** il plugin, per misurare l'impatto reale e non solo se il test
passa in astratto. È lo strumento giusto per validare uno skill/subagent/hook custom prima di
distribuirlo al team, invece di fidarsi del "funziona sul mio caso d'uso".

---

## 9. Memoria persistente (file-based, cross-sessione)

Diversa da CLAUDE.md (istruzioni statiche): è un sistema che l'agente popola da solo nel
tempo, per ricordare fatti tra conversazioni diverse. Struttura tipica:

```
~/.claude/projects/<progetto>/memory/
├── MEMORY.md          # indice, caricato a inizio sessione (prime ~200 righe)
├── feedback_*.md       # correzioni/preferenze confermate dall'utente
├── project_*.md        # stato di iniziative/bug/decisioni in corso
└── reference_*.md       # puntatori a sistemi esterni (Linear, Grafana, ecc.)
```

Ogni file ha un frontmatter `name`/`description`/`metadata.type` (`user`, `feedback`,
`project`, `reference`) e viene linkato dall'indice `MEMORY.md` con una riga sola per entry.
La differenza pratica rispetto a CLAUDE.md: CLAUDE.md è scritto e mantenuto da te; la memoria
auto-generata è scritta dall'agente stesso quando nota una correzione, una preferenza
confermata, o un fatto di progetto non deducibile dal codice — e va *riletta con scetticismo*
prima di riusarla, perché può diventare stale (nomi di funzioni rinominate, feature rimosse).

**Convenzione del path, confermata dal vivo**: lanciando una sessione in questo sandbox,
il campo `memory_paths.auto` dell'evento `system/init` (§1.5.1) è risultato
`/home/emiliano/.claude/projects/-home-emiliano-Documents-claude-code-sandbox--bare/memory/` —
cioè `<progetto>` **non** è il nome della cartella, ma l'intero path assoluto del repository con
`/` sostituiti da `-` (e nel nostro caso il path tracciato è quello del **repo bare**, coerente
col comportamento del trust dialog visto in §2.2.1 — non del worktree `WORKING/`).

---

## 10. Automazione temporale: cron locale vs routine cloud

Due meccanismi distinti, spesso confusi:

| | Cron locale (tool `CronCreate`) | Routine cloud (skill `schedule` + `RemoteTrigger`) |
|---|---|---|
| Persistenza | Solo in memoria, **muore con la sessione** | Persistente, gestita su claude.ai/code |
| Trigger | Solo cron (5 campi, ora locale) | Cron, eventi GitHub (PR/release), chiamata API diretta |
| Scadenza | Auto-espira dopo **7 giorni** (un'ultima esecuzione, poi cancellato) | Nessuna scadenza automatica |
| Uso tipico | "Controllami questo processo ogni 5 minuti mentre lavoriamo insieme" | "Ogni lunedì fai la compliance review", "quando arriva un evento GitHub, avvia una sessione" |
| Esecuzione | Solo quando il REPL è idle | Ambiente cloud dedicato, cloni del repo, connettori MCP |

Il cron locale aggiunge jitter deterministico (fino al 10% del periodo, max 15 min) per evitare
che tutte le richieste "ogni ora in punto" del mondo colpiscano l'API nello stesso istante — se
programmi qualcosa di ricorrente, evita tu stesso i minuti `:00`/`:30` per lo stesso motivo.

Le routine cloud, oltre allo scheduler, supportano trigger via API:

```bash
curl -X POST https://api.anthropic.com/v1/code/triggers/<id>/run \
  -H "Authorization: Bearer <token>"
```

e possono essere agganciate a eventi GitHub (PR aperta, release pubblicata, ecc.) con filtri su
autore, branch, label, draft/merged — utile per "quando questa PR viene aperta, avvia una
review automatica" senza passare da una GitHub Action.

### 10.1 `/loop` — come interpreta davvero l'input

`/loop` è lo skill che programma un prompt ricorrente **per la sola durata della sessione**
(si appoggia al cron locale sopra descritto). Dal testo del prodotto stesso (estratto
ispezionando il binario, non riformulato a memoria), la regola di parsing dell'input è:

1. **Token iniziale**: se il primo token separato da spazio combacia con `^\d+[smhd]$` (es.
   `5m`, `2h`), quello è l'intervallo; il resto è il prompt.
2. **Clausola finale "every"**: altrimenti, se l'input finisce con `every <N><unità>` o
   `every <N> <parola-unità>` (es. `every 20m`, `every 5 minutes`, `every 2 hours`), quello
   diventa l'intervallo ed è tolto dal prompt. Va riconosciuto solo se dopo "every" c'è
   davvero un'espressione temporale — `check every PR` non ha un intervallo.
3. **Default**: altrimenti l'intervallo è quello di default e l'intero input è il prompt.

Esempio: `/loop 5m /babysit-prs` → intervallo `5m`, prompt `/babysit-prs`.

**Nota su durabilità**: alla fine di ogni conferma di `/loop`, il prodotto stesso avvisa
esplicitamente — testualmente — *"Runs until you close this session · For durable cloud-based
loops, use /schedule"*. In altre parole: anche se in alcuni ambienti Claude Code il meccanismo
di scheduling locale supporta in teoria job "durable" scritti su `.claude/scheduled_tasks.json`
(persistenti tra riavvii di sessione nello stesso progetto), in questo ambiente quella modalità
è disattivata — ogni job locale muore con la sessione. Se ti serve davvero persistenza oltre
la sessione corrente (o oltre lo spegnimento della macchina), l'unica via robusta è `/schedule`
(routine cloud), non il cron locale.

---

## 11. Code review cloud multi-agente

```bash
claude ultrareview                    # review sul branch corrente
claude ultrareview 1234               # review su una PR
claude ultrareview --post             # posta i risultati come commento sulla PR (solo target PR)
claude ultrareview --json             # payload grezzo invece dei findings formattati
claude ultrareview --timeout 45       # minuti massimi di attesa (default 30)
```

Equivalente in-sessione: skill `code-review` con livello `ultra` (`/code-review ultra`, o
l'alias deprecato `/ultrareview`). È l'unica modalità di review che gira in cloud con più
agenti in parallelo invece che nel contesto della sessione corrente — costa di più ma copre
molto più codice con meno falsi negativi. Richiede un repository git (offre di fare `git init`
se manca); senza argomenti non serve nemmeno un remote GitHub.

---

## 12. Artifact — pagine pubblicabili con capacità runtime

Un Artifact non è solo "genera una pagina HTML": può avere `capabilities` dichiarate
esplicitamente (dati live, stato condiviso tra viewer, file scaricabili dal viewer,
auto-aggiornamento) — sempre a runtime statico/sandboxato (CSP stretto: niente richieste a
host esterni non dichiarati, niente download avviati dalla pagina stessa). Punti da conoscere:

- **Redeploy in-place**: richiamare l'Artifact con lo stesso `file_path` aggiorna la stessa
  URL; un `file_path` diverso crea un artifact **nuovo**.
- **Versioning del contratto runtime**: `contract` può essere pinnato o aggiornato a `latest`
  esplicitamente — non cambia da solo come effetto collaterale di una modifica.
  `favicon` (1-2 emoji) resta stabile tra redeploy: cambiarlo comunica agli utenti "pagina
  diversa", quindi si cambia solo su un pivot netto di argomento.
- **Privato di default**: nasce privato, va condiviso esplicitamente; su claude.ai
  Team/Enterprise può essere condiviso a livello org o come editor collaborativo.
- **`action: "list"`**: elenca gli artifact pubblicati (propri o condivisi) — utile per
  ritrovare l'URL di un artifact di una sessione precedente e aggiornarlo invece di duplicarlo.

---

## 13. Design Sync — sincronizzazione con design system (claude.ai/design)

Feature di nicchia ma molto recente: un tool dedicato (abbinato alla skill `design-sync`)
permette di tenere sincronizzata una libreria di componenti locale con un progetto
"design-system" su claude.ai, **in modo incrementale** (mai sostituzione totale). Flusso
obbligato: `list_projects`/`list_files` → `finalize_plan` (l'utente vede l'esatto elenco di
path che verranno scritti/cancellati) → `write_files`/`delete_files`. Le card nel pannello
Design System si costruiscono da un marker `<!-- @dsCard group="..." -->` nella prima riga del
file HTML di preview, non serve più registrarle esplicitamente. Rilevante se il tuo team
gestisce un design system versionato e vuole che Claude Code lo tenga aggiornato senza
rischiare un "replace" distruttivo.

---

## 14. Rewind e checkpoint

Feature confermata direttamente nel binario installato (non era nel report iniziale, l'ho
aggiunta dopo verifica): **Esc-Esc** (doppio tap di Esc) o il comando `/rewind` aprono un menu
per riportare indietro **codice e/o conversazione** a un punto precedente della sessione.
Testo prodotto reale: *"Double-tap esc to rewind the code and/or conversation to a previous
point in time"*.

- Ogni prompt utente crea un checkpoint automatico (snapshot di file coinvolti, non dell'intero
  disco).
- `/rewind` da solo, dopo un turno, annulla le modifiche ai file fatte in quel turno
  ("`/rewind` to roll back the turn's tool edits").
- Esiste anche un flag CLI **non documentato in `--help`**: `--rewind-files <user-message-id>`
  — richiede `--resume` (non può essere usato assieme a un nuovo prompt: *"--rewind-files is a
  standalone operation and cannot be used with a prompt"*). Serve per riportare indietro i file
  di una sessione ripresa a un punto preciso, identificato dall'UUID del messaggio utente,
  via scripting — utile in pipeline dove vuoi annullare programmaticamente l'effetto di un
  turno specifico senza passare dal menu interattivo.

Limite da conoscere: le modifiche fatte da `Bash` (es. `rm`, `mv`, script che riscrivono file)
non sono tracciate da questo meccanismo — solo le modifiche fatte tramite i tool nativi di
editing sono ripristinabili.

---

## 15. Personalizzazione della sessione: statusline, keybindings, output style, multi-sessione

Un gruppo di comandi/feature poco pubblicizzate ma reali, utili quando lavori con più sessioni
Claude Code in parallelo (es. più worktree, come nel progetto sandbox):

- **`/statusline`** — configura una barra di stato personalizzata sotto il box di input,
  tipicamente delegata a uno script (`~/.claude/statusline-command.sh` o path equivalente su
  Windows). Rilanciare `/statusline` per modificarla.
- **`/color`** e **`/rename`** — testo prodotto reale: *"Running multiple Claude sessions? Use
  /color and /rename to tell them apart at a glance."* `/rename <nome>` etichetta la sessione
  (compare nel picker `/resume` e nel titolo del terminale); `/color` le assegna un colore
  distintivo. Fondamentale se lavori con più worktree/sessioni aperte contemporaneamente, come
  suggerito in §3.
- **Output style** — la feature esiste tuttora, ma il comando dedicato `/output-style` è stato
  **rimosso**: si configura ora da `/config` → *Output style*. Segnalo questo esplicitamente
  perché è il tipo di dettaglio che invecchia più in fretta in un tutorial — se trovi guide che
  citano `/output-style` come comando diretto, sono outdated.
- **Keybinding personalizzate** — modificabili in `~/.claude/keybindings.json` (rebind tasti,
  chord binding).

---

## 16. Agent team (teammate)

Oltre ai subagent "usa e getta" (§4), esiste un concetto di **teammate**: un agente con un nome
persistente all'interno di un "team", indirizzabile con `SendMessage` passando `to: "nome"`
(la tabella di instradamento di `SendMessage` include esplicitamente "Teammate by name"). Per
fermare un teammate si usa `TaskStop` passando il suo agent ID nel formato **`nome@team`**
oppure il solo nome.

Limite noto e confermato dal prodotto stesso: *"durable crons are not supported for teammates
(teammates do not persist across sessions)"* — un teammate non sopravvive alla chiusura della
sessione, quindi non ha senso provare a schedulargli un cron ricorrente "durevole": va trattato
come un collaboratore effimero legato al ciclo di vita della sessione corrente, diverso da una
routine cloud (§10) che invece è pensata proprio per sopravvivere.

---

## 17. Come usare il resto di questo progetto sandbox

- `src/inventory.ts` — bug intenzionale (gestione `quantity` negativa non gestita in
  `totalValueCents`): buon terreno per provare `.claude/agents/reviewer.md` (subagent di sola
  review, tool limitati a `Read/Grep/Glob`) o `/code-review`.
- `.claude/skills/inventory-report/SKILL.md` — prova a chiedere "fammi un report
  dell'inventario" e osserva l'auto-invocazione.
- `.claude/settings.json` — hook `PostToolUse` che rilancia `tsc --noEmit` dopo ogni `Edit`:
  buon punto di partenza per capire il ciclo hook → osserva l'output con
  `claude --debug hooks`.
- Prova `claude --worktree prova-refactor` da questa repo per vedere il flusso di worktree
  nativo confrontato con quello bare+worktree già in uso (`.bare/` + `WORKING/`).

Nessun file è stato committato: `git status` nel worktree `WORKING` mostra tutto come
untracked, pronto per una prima revisione manuale prima di un eventuale commit.
