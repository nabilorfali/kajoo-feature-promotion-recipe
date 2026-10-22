# Script tests

Run from this skill directory:

```
node --test tests/check-decisions.test.mjs tests/materialize-shortlist.test.mjs tests/validate-task-result.test.mjs
```

The tests use real subprocesses and temporary run folders, need no npm install, and clean up only their own temporary directories. They cover stale and missing approvals, choices that do not approve, newer decisions replacing older ones, shortlist materialization only after a current approval, refusal to overwrite, worker results for the wrong task, evidence that changed after the result was written, and paths that leave the run folder. `materialize-shortlist.test.mjs` also checks its output with the shared `workflow` validator. These are local contract tests, not a live run against Jira or ReadMe.
