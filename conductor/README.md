# Conductor

Conductor holds **plans for work in flight**. Everything else lives elsewhere:

| Need                                      | Where                                       |
| ----------------------------------------- | ------------------------------------------- |
| What is in progress / next                | [`docs/STATUS.md`](../docs/STATUS.md)       |
| Backlog and bugs                          | GitHub Issues                               |
| What shipped                              | [`docs/CHANGELOG.md`](../docs/CHANGELOG.md) |
| Rules and commands                        | [`AGENTS.md`](../AGENTS.md)                 |
| Product, architecture, decisions, lessons | [`docs/`](../docs/)                         |

## Layout

```text
conductor/
  tracks/<name>_<YYYYMMDD>/   # active work
    spec.md                   # what and why: scope, acceptance criteria
    plan.md                   # how: phases > tasks, checkboxes
  archive/<name>_<YYYYMMDD>/  # finished tracks (git mv from tracks/)
  opencode_tasks/             # local scratch for opencode; gitignored, never committed
```

The folder listing is the registry. There is no `tracks.md`, `index.md` or `metadata.json`; `docs/STATUS.md` links to every active track.

## When to create a track

Create one for any feature, refactor or bug that spans more than one PR or needs a written plan. Small single-PR fixes need no track; a GitHub issue and the PR are enough.

## Lifecycle

1. Create `tracks/<name>_<YYYYMMDD>/` with `spec.md` and `plan.md` (templates below) and link it from the _In progress_ section of `docs/STATUS.md`.
2. Work tasks in order: mark `[~]`, write the failing test, implement, then mark `[x]` and append the 7-character commit SHA.
3. Record any deviation from the spec in `plan.md` as a dated note with the reason.
4. When every task is `[x]`: `git mv` the folder to `archive/`, add the shipped items to `docs/CHANGELOG.md`, and remove it from STATUS. Put anything non-obvious you learned in `docs/LESSONS.md` and any real choice in `docs/decisions/`.

## `spec.md` template

```markdown
# Spec: <title>

## Goal

<one paragraph: the problem and the outcome>

## Scope

- In: ...
- Out: ...

## Acceptance criteria

- [ ] ...

## Open questions

- ...
```

## `plan.md` template

```markdown
# Plan: <title>

Spec: [spec.md](./spec.md) · Issue: #<n> · Branch: `<branch>`

## Phase 1: <name>

- [ ] Task (write tests first)
  - [ ] Subtask
- [ ] Manual verification of phase 1 `[checkpoint: <sha>]`

## Notes

- YYYY-MM-DD: <deviation or decision, with reason>
```

Status markers: `[ ]` not started, `[~]` in progress, `[x]` done.
