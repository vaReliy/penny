# Docs Style (local)

Consumer-owned mirror of `rules/cts/docs-style.md` (which is `Edit`-denied). This file holds this project's docs-authoring gotchas that don't belong in the synced CTS file.

## Prettier corrupts markdown when a bold span sits next to an inline-code glob starting with a double asterisk

Writing a bold span immediately followed by inline code containing a leading globstar (the ESLint/minimatch "match any directory" pattern) gives Prettier two readings of the asterisk run — bold-close versus glob-open. It resolves them wrongly and rewrites the line into genuinely broken output: emphasis markers left dangling, backticks glued to adjacent words with the surrounding spaces eaten, and stray backslash escapes inserted mid-pattern. It is silent, happens on `--write`, and the damage is a formatting change rather than an error, so `--check` passes afterward and CI never notices.

This repo has hit the same defect at least twice — once fixed by a commit whose message includes "fix markdown bold/glob corruption," with the cause left unrecorded, and again while documenting the cause itself for the first time.

Mitigations, in order of preference:

1. Describe the pattern in prose instead of inline code — e.g. write "a globstar-prefixed `application/**/*.ts` pattern" — so no asterisk run ever touches an emphasis marker.
2. If the literal must appear, put it in a fenced code block rather than inline code.
3. Never place inline code starting or ending with an asterisk directly adjacent to bold/italic markers.

General rule: any inline code span whose content begins or ends with an asterisk or underscore needs a non-emphasis character between it and any adjacent emphasis marker.

## Line-number citations in guides are load-bearing and rot silently

A guide citing exact line ranges across several files can be entirely correct at audit time — genuinely good evidence the guide matches shipped code — but any later edit to those files silently rots the citation with no signal. Line-based citations are also vulnerable to non-obvious dependencies: if a citation depends on a field sitting at a fixed line number in every instance of a repeated file shape (e.g. a config array element expected at the same line across sibling projects), and nothing enforces that position or a consistent element order, naive position-based audits are defeated even when the citations still happen to be correct.

Consider asserting line-number citations in CI (e.g. a script that re-resolves each cited `file:line` and diffs the surrounding content against what the guide quotes) rather than relying on periodic manual review.

## A detection tool's exclusion prose and its actual scan-pattern list are two independently-maintained surfaces

A citation-audit skill's "Do NOT flag" exclusion prose and its actual scan-pattern list can drift apart — fixing one does not fix the other. Correcting the exclusion text alone can still leave a tool blind if its scan patterns only match a narrower shape than the prose implies (e.g. patterns matching only full date-sequence identifiers and backticked decision IDs, missing bare "task NN" prose entirely). A regex addition to close a gap like this needs an explicit before/after check against the concrete violation text, not just a description that sounds right — a first-pass fix can itself ship an incomplete pattern (e.g. case-sensitive, missing a capitalized variant) and still look fixed.

General discipline: for any detection tool with prose describing intended scope kept separate from the code/pattern implementing it, diff both surfaces against the literal text of the violation the fix targets, not just the wording of the fix.
