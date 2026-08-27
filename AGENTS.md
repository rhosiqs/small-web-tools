## Agent skills

### Issue tracker

Issues and specs are tracked in this repository's GitHub Issues, except security-related work, which must use local gitignored Markdown files. See `docs/agents/issue-tracker.md`.

### Triage labels

The default five-role triage label vocabulary is used. See `docs/agents/triage-labels.md`.

### Domain docs

This repository uses the single-context domain-doc layout. See `docs/agents/domain.md`.

### Project-level skills

Repository-specific workflows are project-level skills under `.claude/skills/`, read
when a task needs them. `.claude/skills/add-tool/SKILL.md` covers adding, renaming, or
removing a routed tool.
