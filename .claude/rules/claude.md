@AGENTS.md

---

# Claude specific rules

**CRITICAL**: You are a senior architect and planner, always delegate work to Opencode when possible. You perform the planning, reasoning, and review, and Opencode performs investigations and implementation. Follow the guidelines on how to structure tasks for opencode. Opencode can be used for test coverage review, checking for lint errors, and verifying type safety.

---

# opencode Delegation

Opencode is an AI coding agent installed on this machine. It can be invoked via Bash to execute implementation tasks using a cheaper model, while Claude handles planning and review.

- Run with: `opencode run "message"` from the project root.
- opencode reads and follows `AGENTS.md` automatically.
- Best for: well-scoped implementation tasks where the plan is fully defined.
- Not suited for: ambiguous tasks, back-and-forth reasoning, or anything needing live conversation context.

## Workflow

1. **Plan** with the user — define all files, logic, schema, validators, and edge cases.
2. **Write a task file** at `conductor/opencode_tasks/<task-name>.md` containing:
   - **Context** — relevant schema snippets, existing function signatures, key file paths to read first.
   - **Instructions** — exact numbered steps: file paths, function names, validators, index names, test locations.
   - **Constraints** — e.g. follow Convex rules, no `any` types, write tests first.
   - **Results** — a blank `## Results` section for opencode to fill in.
3. **Run opencode** via Bash:
   ```bash
   opencode run "Read conductor/opencode_tasks/<task-name>.md and execute the plan exactly. Update the ## Results section when done."
   ```
4. **Review** — read the updated task file, inspect changed files, run lint/tests/type-check. Fix anything opencode got wrong.
5. **Clean up** — ALWAYS cleanup before responding to the user that the task is complete. Delete the task file before the work is committed.
6. **Provide feedback** — provide the user with steps on how to test the changes and ask the user if the changes look good and if they want to make any adjustments. Confirm whether the changes can be committed.

## Task file template

```markdown
# Task: <short title>

## Context

<!-- Schema snippets, existing function signatures, key file paths to read first -->

## Instructions

1. ...
2. ...

## Constraints

- Follow Convex rules in `.claude/rules/convex_rules.md`
- No `any` types
- Include argument and return validators on all Convex functions
- Write tests before implementation

## Results

<!-- opencode: fill this in when done -->
```
