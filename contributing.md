# Contributing to Sling

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- VS Code (for extension development)

### Getting Started

```bash
# Clone the repo
git clone https://github.com/slng/sling.git
cd sling

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint
```

### Project Structure

```
sling/
├── packages/
│   ├── definition/       # @slng/definition — core library
│   │   ├── src/
│   │   │   ├── index.ts          # Public API barrel
│   │   │   ├── types.ts          # All TypeScript types
│   │   │   ├── sling.ts          # sling() factory function
│   │   │   ├── parser.ts         # HTTP template parser
│   │   │   ├── definition.ts     # SlingDefinition creation + execution
│   │   │   ├── plugins/
│   │   │   │   └── dotenv.ts     # useDotEnv plugin
│   │   │   └── masking/
│   │   │       ├── secret.ts     # secret() utility
│   │   │       └── sensitive.ts  # sensitive() utility
│   │   └── tests/
│   ├── cli/              # @slng/cli — CLI runner
│   │   ├── src/
│   │   │   ├── index.ts          # Public API barrel
│   │   │   ├── bin.ts            # Entry point (shebang)
│   │   │   ├── args.ts           # Argument parser
│   │   │   ├── loader.ts         # Module loader + glob discovery
│   │   │   └── runner.ts         # Execution + output formatting
│   │   └── tests/
│   └── vscode-extension/ # @slng/vscode-extension
│       └── src/
│           ├── extension.ts              # Activation + command registration
│           ├── providers/
│           │   ├── codelens.ts           # CodeLens provider
│           │   └── send.ts              # Request execution via child process
│           ├── panels/
│           │   └── response.ts          # Webview response panel
│           └── debug/
│               └── launcher.ts          # Debug session launcher
├── examples/             # Example project
├── docs/
│   ├── user-guide/
│   └── contributing/     # You are here
└── .github/workflows/    # CI/CD
```

### Architecture Decisions

**Why tagged templates?** They read like raw HTTP but with full TypeScript interpolation. No custom file format, no separate parser — it's just TypeScript.

**Why child processes for VS Code?** The "Send" and "Debug" commands spawn tsx as a child process rather than importing the user's module in the extension host. This keeps execution transparent: the same code path runs in CLI and editor, and the debugger attaches to real user code with no hidden layers.

**Why pnpm workspaces?** Each package has a clear boundary and its own publish lifecycle. Workspace protocol (`workspace:*`) keeps them linked during development.

### Working on Packages

Each package uses `tsup` for building. During development:

```bash
# Watch mode for a specific package
cd packages/definition
pnpm build --watch

# Run tests in watch mode (from root)
pnpm test:watch
```

### Adding a Plugin

Plugins implement the `SlingPlugin` interface:

```typescript
import type { SlingPlugin } from './types.js'

export function myPlugin(options: MyOptions): SlingPlugin {
  return {
    name: 'my-plugin',
    setup(context) {
      // Modify context.envSets, context.environments, etc.
    },
  }
}
```

Plugins are applied synchronously where possible. If your plugin needs async setup, return a Promise from `setup()` — the CLI/extension will await it before execution.

### Adding an Editor Extension

The project is structured to support multiple editors. To add support for a new editor (e.g., JetBrains/Rider):

1. Create `packages/<editor>-extension/`
2. Depend on `@slng/definition`
3. Implement:
   - Definition discovery (scan for `export ... = sling\`...\`` patterns)
   - Send action (import module, call `.execute()`)
   - Debug action (launch debugger with the runner script pattern from `vscode-extension/src/debug/launcher.ts`)
   - Response display

The core execution logic lives in `@slng/definition` — editor extensions are thin wrappers.

### Code Style

- ESLint with `@typescript-eslint` — run `pnpm lint` before committing
- Prefer `type` imports (`import type { ... }`)
- No `any` unless truly unavoidable (use `unknown` + type guards)
- All public APIs need JSDoc comments

### Testing

- Vitest for all packages
- Tests live in `packages/<name>/tests/`
- Run from root: `pnpm test`
- Aim for coverage on core logic (parser, masking, definition creation)

### Pull Request Process

1. Fork and create a feature branch
2. Write/update tests
3. Run `pnpm lint && pnpm test && pnpm build`
4. Open a PR with a clear description
5. CI will run build, lint, and test
