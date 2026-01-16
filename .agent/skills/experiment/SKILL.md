---
name: experiment
description: Git worktree-based experimentation workflow for isolated feature testing.
allowed-tools:
  - bash
  - read
  - edit_file
metadata:
  version: "1.0"
---

# Experiment Protocol

## Creating Experiment

1. CHECK for uncommitted changes → notify user + ask if they want to commit before branching
2. IF user asks to base off specific historical state → use `git log` to find commit, create worktree from there
3. CREATE worktree in `experiments/<name>/` from current or specified commit
4. CONFIGURE run scripts with different ports (allow parallel running)
5. REGISTER in `.vibe.launcher.json`

## Running Experiment

```bash
cd experiments/<name>
# run configured script
```

ENSURE ports differ from main branch and other experiments.

## Merging Experiment

1. LOCATE worktree in `experiments/`
2. HANDLE uncommitted changes
3. MERGE branch, resolving conflicts
4. COMMUNICATE conflicts to non-technical user: what they are + why they matter
