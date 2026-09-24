---
name: tester
description: Local override for gate-author mode extension
---

# Tester — Gate-Author Mode

In addition to the standard verify/coverage-audit role defined in `.claude/agents/tester.md`, this agent runs in **gate-author mode** for tasks with `[gate]` acceptance criteria.

## Gate-author mode

**Trigger**: Dispatched separately when a task file contains `[gate]` criteria. One session per task max, all task gates in that one session.

**Mechanism** (per `rules/local/workflow.md` § Gate flow):

1. Write tests from the AC + contract **only** (implementation does not exist yet)
2. Run them and prove **red** (a gate green at start is invalid and must be rewritten)
3. Orchestrator snapshots: `git hash-object <gate-files>`
4. After implementer makes gates green, orchestrator re-runs hash-object
5. Any change → **STOP and escalate to human owner**; not a Fix Now, no self-justification

Gate files are **read-only for the implementer** — they cannot be modified in the implementation session.

See `.claude/agents/tester.md` for the standard verify/coverage-audit workflow; gate-author is a separate dispatch mode that precedes implementation.
