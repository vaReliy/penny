# Knowledge Inbox

Append-only queue for durable, project-relevant learnings whose final home isn't clear yet. Distilled into PROJECT_CONTEXT.md / CLAUDE.md / a rule / a skill, then deleted from here — this file should trend toward empty.

## 2026-06-25 — code review: flag history-flavored words in doc comments

Why: a comment that says "no longer does X" / "now does Y" / "used to be Z" describes the diff that produced the current code, not the current invariant — it reads fine right after the change but rots the moment the next change lands, since nobody remembers to revisit prose. Comments should state the present-tense rule/contract ("does not do X; callers must do Y"), never the change history (that belongs in the commit message/PR description).
Belongs in (guess): rule (rules/code-style.md, as a review checklist item) or reviewer agent instructions
