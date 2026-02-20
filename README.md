# Sling

**TypeScript-first HTTP client for developers.** Define requests as tagged template literals, run them from the CLI or your editor.

```typescript
import sling from './slng.config.mjs'

export const getUsers = sling`
  GET https://api.example.com/users HTTP/1.1

  Authorization: Bearer ${process.env.TOKEN}
`
```

## Why Sling?

Sling sits between tools like Postman (heavy GUI, no version control) and raw `curl` commands (no structure, no editor integration). It gives you:

- **Plain TypeScript** — your HTTP definitions are just `.mts` files. Version them, review them, share them.
- **Tagged template syntax** — reads like HTTP, writes like code. Full interpolation support.
- **Request chaining** — one request's response feeds into the next via async functions. No special DSL.
- **Secret masking** — `secret()` and `sensitive()` keep credentials out of logs and the response viewer.
- **Editor integration** — CodeLens shows "Send | Debug" right above each export. Debug attaches a real debugger to *your* code.
- **CLI-first** — `npx @slng/cli --file ./api.mts "getUsers"` works out of the box.

## Quick Start

```bash
# Install
pnpm add @slng/definition @slng/cli

# Create config
cat > slng.config.mts << 'EOF'
import sling, { useDotEnv } from '@slng/definition'
export default sling(useDotEnv('local'))
EOF

# Create a request file
cat > api.mts << 'EOF'
import sling from './slng.config.mjs'

export const healthCheck = sling`
  GET https://httpbin.org/get HTTP/1.1
`
EOF

# Run it
npx @slng/cli --file ./api.mts
```

## Packages

| Package | Description |
|---------|-------------|
| [`@slng/definition`](./packages/definition) | Core library — sling factory, parser, plugins, masking utilities |
| [`@slng/cli`](./packages/cli) | CLI tool — run definitions from the terminal |
| [`@slng/vscode-extension`](./packages/vscode-extension) | VS Code extension — CodeLens, response viewer, debug integration |

## Documentation

- [User Guide](./docs/user-guide/README.md) — full walkthrough from setup to advanced usage
- [Contributing](./docs/contributing/README.md) — development setup, architecture, and how to contribute

## License

MIT
