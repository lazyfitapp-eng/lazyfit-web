<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# LazyFit Codex Operating Contract

Every Codex session in this repo must start with a state check:

1. Run and report `git status --short`, `git branch --show-current`, `git log -1 --oneline`, and `git rev-parse HEAD`.
2. Read `AGENTS.md`, `CURRENT_STATE.md` ACTIVE STATE, `docs/LAZYFIT_ENGINEERING_RULES.md`, and `docs/BACKLOG.md` when relevant.
3. Treat `CURRENT_STATE.md` ACTIVE STATE as the live source of truth when it conflicts with older docs, stale chat context, or older reports.

Every task must declare exactly one mode:

- audit/design only
- implementation
- validation/smoke
- deployment
- docs-only
- validation-runner creation only

Codex should work autonomously within the declared mode. For implementation and validation tasks, loop through inspection, command failures, TypeScript/build errors, validation-runner repair, DB/API checks, and safe QA-data investigation for roughly 20-30 minutes unless destructive approval is required, secrets are missing, real product/data risk is discovered, a capability boundary is hit, or the task is complete.

Do not make Tudor paste giant browser or PowerShell scripts. For browser/UI validation, create a temporary runner under `.codex-temp/<sprint-name>/` and have Tudor run one short command:

```powershell
powershell -ExecutionPolicy Bypass -File .\.codex-temp\<sprint-name>\run.ps1
```

Temporary runners must stay under `.codex-temp/`, never modify app source or package files, output Markdown and JSON reports, save screenshots/artifacts under the same temp folder, clearly report QA data created or mutated, and be deleted before commit unless Tudor explicitly keeps them.

Codex direct Brave/Playwright launch has repeatedly failed with `browserType.launch: spawn EPERM`. Do not waste time repeatedly retrying direct browser launch. Create local Playwright runners when browser validation is needed, and treat validation as incomplete until the local runner passes or the blocker is explicitly reported.

Data safety is mandatory: no real user data mutation, QA data only under disposable QA accounts, no deleting QA rows without explicit action-time confirmation, and no production settings/env/DNS/Supabase/Vercel changes unless the sprint explicitly requires it.

Parallel Codex sessions are allowed only when scopes do not overlap. Safe examples: one implementation/deploy session, one audit-only session, and one docs-only workflow session. Unsafe examples: two sessions editing the same files or same feature area. Parallel implementation requires an isolated worktree/branch and must be reported.

Codex never commits or pushes. Tudor commits manually after ChatGPT review. One coherent sprint should become one coherent commit.

Every report must include state check, mode, files changed, validation run, data created/mutated, risks, final git status, and suggested commit message.

Until the Friday release push, avoid broad "while here" work and new major systems after Weekly Check-In Step Average unless explicitly approved. Prioritize P0/P1 trust blockers. Food search relevance and training logging reliability are release-critical.

## Do Not Do

- Do not paste giant scripts to Tudor.
- Do not fake browser validation.
- Do not call typecheck enough for UI.
- Do not modify `docs/QA_FINDINGS.md` unless asked.
- Do not silently delete QA data.
- Do not make calorie changes from steps.
- Do not add dashboard cards or a recommendation engine unless the sprint asks.
