---
name: docs-citation-audit
description: >-
  Scans committed docs for task-file citations, decision IDs, and dangling path references. Runs two mechanical checks: (A) flags backticked/unquoted task filenames (tasks/*.md) and bare decision IDs (D\d+); (B) verifies backticked file paths referenced in prose actually exist on disk. Emits ranked findings and offers to rewrite citations to content-level descriptions per rules/cts/docs-style.md guidance. Run after any session touching committed docs (KNOWLEDGE_INBOX.md, guides, README sections), or periodically to catch silent drift.
  
  Українською: аудит документації, перевірити цитування, посилання на задачі, документація гігієна.

triggers:
  - docs-citation-audit
  - audit docs
  - check citations
  - doc hygiene
  - аудит документації
  - перевірити цитування
---

# Docs Citation Audit

Scans committed documentation for task-file citations, decision IDs, and dangling path references. Emits ranked findings and offers to rewrite citations to content-level descriptions per `rules/cts/docs-style.md` § "Committed files never cite task files or decision IDs."

## Step 1 — Determine scope

Run:

```
git status --short
```

**Session-aware** (files changed this session): if any paths under `docs/`, `README.md`, `CHANGELOG.md`, `.claude/agents/`, `.claude/skills/`, or `rules/local/` appear in `git status --short` output, audit those specific files. Proceed directly to Step 2.

**History-aware** (no session changes): inspect recent activity:

```
git log --oneline --since="7 days ago" -- docs/ README.md CHANGELOG.md .claude/agents/ .claude/skills/ rules/local/
```

Then prompt:

```
Found N commits touching docs, README, and .claude/ in the last 7 days.
Audit this window, or specify a different range? (e.g. "3 days", "since 2026-06-20", "all")
```

Wait for the user's response before proceeding.

## Step 2 — Run both checks

Run all checks. Collect findings across both before reporting.

---

### Check A — Task-file and decision-ID citations

Scan these files:

- `docs/**/*.md` (all)
- `rules/local/**/*.md` (all)
- `README.md`
- `CHANGELOG.md`
- `.claude/agents/*.md`
- `.claude/skills/*/SKILL.md`

**Exclude (legitimate illustrative exceptions per rules/cts/docs-style.md line 58)**:

- `rules/cts/task-authoring.md`
- `docs/USAGE.md`

For each file in scope, search for:

1. **Task-file paths**: pattern `tasks/\S+\.md` (bare repo-relative paths citing files under `tasks/`)
2. **Backticked task-ID citations**: pattern `` `\d{4}-\d{2}-\d{2}-\d{2}(-[a-z0-9-]+)?` `` (backticked date-NN identifiers with optional slug suffix; matches both `2026-07-22-01` and `2026-07-22-01-slug-text`)
3. **Unquoted task-ID citations**: same date-NN pattern `\d{4}-\d{2}-\d{2}-\d{2}(-[a-z0-9-]+)?` appearing in prose without backticks (rules/cts/docs-style.md § rule is not backtick-conditional)
4. **Decision IDs**: pattern `` `\bD\d+\b` `` (backticked, e.g. `` `D7` ``)
5. **Bare task-number citations**: pattern `\b[Tt]ask\s+\d{1,3}(\s*[-–]\s*\d{1,3})?\b` (unquoted task sequence numbers in prose, e.g., "task 04", "task 16–19", "task 03", "Task 04"; matches both lowercase and capitalized forms; violation of rules/cts/docs-style.md § "Committed files never cite task files or decision IDs" rule, which applies equally to bare number formats)

**Do NOT flag**:

- Generic illustrative filenames or task-workflow examples in documentation that teaches the task process itself (e.g., `rules/cts/task-authoring.md`'s naming examples, `docs/USAGE.md`'s recipe commands) — per docs-style.md line 58, these are placeholders demonstrating a format, not citations of real work items
- Task filenames that appear in code examples inside fenced blocks (triple-backtick markdown code) — those are illustrative, not prose citations
- `ADR-007` / `DECISIONS.md` references when they refer to the actual committed files (legitimate cross-references, not task-file citations)

**Finding format**:

```
[MED]  <file>:<line>: cites task-file/decision-ID "<match>" — rules/cts/docs-style.md § "Committed files never cite task files or decision IDs" violation
```

---

### Check B — Dangling path references

For the same file set as Check A (same exclusions), extract any backticked string that looks like a repo-relative file path in prose:

- Pattern: backticked strings (delimited by backticks) containing at least one `/` and a plausible extension (`.ts`, `.md`, `.js`, etc.) OR matching a known repo top-level directory prefix (`libs/`, `apps/`, `rules/`, `docs/`, `.claude/`).
- Examples that should be extracted: `` `libs/foo/bar.ts` ``, `` `rules/cts/x.md` ``, `` `apps/api/src/...` ``, `` `.claude/agents/foo.md` ``
- Examples to skip: `` `path/to/thing` `` without an extension, `` `foo.bar` `` (no directory), `` `node_modules/...` `` (external)

For each extracted path, verify it exists on disk:

```
ls <path>
```

If the path does not resolve (file not found, directory not found), flag it.

**Finding format**:

```
[MED]  <file>:<line>: references path "<path>" which does not exist on disk — dangling reference
```

---

## Step 3 — Emit ranked report

Output findings grouped by severity:

```
## Findings — <scope description>

### MED
[MED]  <finding>
       <detail line>

## Summary
- MED: N  (total: N findings)
```

If no findings: output `## Findings — <scope>\nNo issues found.`

---

## Step 4 — Fix findings

After reporting, ask:

```
Fix Check A findings (rewrite citations to content-level descriptions)? (y / n)
```

If yes (`y`):

For each Check A finding, rewrite the citation per `rules/cts/docs-style.md` guidance:

- If the citation refers to a specific shipped task/decision, replace it with: a commit SHA (via `git log -S<marker>` if findable), a file path to the actual implementation, or a short content description (e.g., "the fix that added FX-conversion to balance rendering" instead of a task filename)
- Preserve the entry's informational content — the rewrite must not lose what the original citation was trying to point to
- Edit in place and show the diff of each rewrite

For Check B (dangling paths), ask separately:

```
Review Check B dangling-path findings for false positives? (y / n / select numbers)
```

- **y**: evaluate all findings case by case. For genuinely stale/broken references, fix or flag inline with a short explanation (e.g., "file moved to X" or "invalid reference, removed"). For findings that look like false positives (e.g. a code example, not a real citation), skip with reasoning noted.
- **n**: skip all B findings as-is.
- **select numbers**: review only the specified findings (1, 3, 5, etc.).

After fixes are applied, re-run Check A's grep patterns against the modified files and confirm zero matches (excluding the two documented exception files).

---

## Notes

- This skill is read-only except in fix mode (Edit to rewrite citations).
- Check A patterns are heuristics. False positives may occur in code examples or prose that coincidentally matches the pattern — use judgment before flagging.
- Check B path heuristics will miss some dangling references (e.g. unquoted paths) and may flag false positives (e.g. a substring that looks like a path but isn't). Evaluate findings, don't blindly fix all.
- The legitimate exception files (`rules/cts/task-authoring.md`, `docs/USAGE.md`) are explicitly named and illustrated in their own prose — they are allowed to cite tasks/decisions as teaching examples, not rule violations.
