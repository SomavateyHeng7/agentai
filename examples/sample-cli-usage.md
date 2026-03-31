# Sample CLI Usage

## List available workflows

```bash
npm run build
npm run cli -- list
```

## Run sales orchestration with inline JSON

```bash
npm run cli -- run sales-orchestrate --json '{
  "email": "cto@example.com",
  "company": "Acme Corp",
  "message": "We need enterprise automation and have budget approved.",
  "source": "website"
}' --pretty
```

## Run support triage from file input

```bash
npm run cli -- run support-triage --input ./examples/support-ticket.sample.json --pretty
```

## Run A/B test from config file

```bash
npm run cli -- ab-test --input ./examples/ab-test-config.sample.json --pretty
```
