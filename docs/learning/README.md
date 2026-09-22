# The learning system lives in Obsidian now

**Moved 2026-09-22.** This folder is a pointer, not the system.

## Where it actually is

```
C:\Users\rohit\OneDrive\Documents\Rohit Ai Brain\ImSmriti Anatomy\
```

| Note | Purpose |
|---|---|
| `HOME - ImSmriti Anatomy.md` | Dashboard — start here |
| `Curriculum.md` | All 275 lessons, 16 parts, permanently numbered |
| `Progress.md` | What's been taught |
| `Learning Log.md` | Rohit's own words on each lesson |
| `Lessons/` | One note per taught lesson — the permanent book |
| `Lessons.base` | Obsidian database views (backlog, not-logged, posted) |

## Why it moved

Rohit reads and writes in Obsidian daily. A learning system he has to open a
code editor to read is a learning system he won't open. The vault also gives it
things this repo can't: one note per lesson, wikilinks between related topics,
frontmatter-driven database views, and graph view across 275 lessons.

## The commands

`/learn` and `/content` are global commands at `~/.claude/commands/` and write
directly to the vault. They were previously project-scoped here — that was
removed so the global versions take effect.

## What stayed in this repo

The **strategy** docs, because they belong to the app project rather than to
Rohit's personal learning:

- `CONTENT-STRATEGY.md` — universe, differentiator, pillars, compliance
- `CONTENT-DISTRIBUTION.md` — the send-first distribution plan
- `CONTENT-SCRIPTS-WEEK-01.md` — the first four post scripts
- `CONTENT-RESEARCH-VALIDATION.md` — verified India health statistics
- `CONTENT-LEARNING-ENGINE.md` — why the learning loop exists
- `TOPIC-BANK-PLAYBOOK.md` — the 65-topic backup shelf

`/content` reads these from the repo while writing state to the vault.
