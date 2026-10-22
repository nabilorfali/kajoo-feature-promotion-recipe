# Script tests

Run from this skill directory:

```
node --test tests/build-readme-request.test.mjs
```

The tests use a real subprocess and a temporary folder, need no npm install, and clean up after themselves. They are local contract tests and never call ReadMe.
