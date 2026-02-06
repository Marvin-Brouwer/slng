# Sling User Guide

## Table of Contents

1. [Installation](#installation)
2. [Configuration](#configuration)
3. [Defining Requests](#defining-requests)
4. [Environment Variables](#environment-variables)
5. [Secret Masking](#secret-masking)
6. [Request Chaining](#request-chaining)
7. [CLI Usage](#cli-usage)
8. [VS Code Extension](#vs-code-extension)
9. [Debugging](#debugging)

---

## Installation

```bash
pnpm add @slng/config @slng/cli
```

For the VS Code extension, install `@slng/vscode-extension` from the marketplace (or build from source — see [Contributing](../contributing/README.md)).

### Requirements

- Node.js 20+
- `tsx` installed globally or as a dev dependency (used for running `.mts` files)


## Configuration

Create a `slng.config.mts` at your project root (or wherever makes sense for your repo):

```typescript
// slng.config.mts
import sling, { useDotEnv } from '@slng/config'

export default sling(
  useDotEnv('local', 'staging', 'production'),
)
```

The `sling()` function accepts plugins. Currently available:

### `useDotEnv(...environments)`

Loads `.env` files into the sling context. Each environment name corresponds to a `.env.<name>` file.

Given `useDotEnv('local', 'staging')`, sling loads:

- `.env` — always loaded as the base
- `.env.local` — merged on top when "local" is the active environment
- `.env.staging` — merged on top when "staging" is the active environment

The first listed environment becomes the default. Variables are applied to `process.env`, but existing values are never overwritten.


## Defining Requests

Create `.mts` files that import your configured sling instance and export request definitions:

```typescript
// apis/users.mts
import sling from '../slng.config.mjs'

const host = process.env.API_HOST ?? 'localhost:3000'

export const getUsers = sling`
  GET https://${host}/api/users HTTP/1.1

  Accept: application/json
`

export const createUser = sling`
  POST https://${host}/api/users HTTP/1.1

  Content-Type: application/json

  {
    "name": "Jane Doe",
    "email": "jane@example.com"
  }
`
```

### Template Format

The template follows standard HTTP message syntax:

```
METHOD URL [HTTP/VERSION]

Header-Name: Header-Value
Header-Name: Header-Value

body
```

- **Request line** — method and URL are required. HTTP version defaults to `HTTP/1.1`.
- **Headers** — separated from the request line by a blank line. Each header on its own line as `Name: Value`.
- **Body** — separated from headers by a blank line. Can be any text.

### Interpolations

Standard tagged template interpolation with `${}`:

- **Strings and numbers** — inlined directly
- **`secret(value)`** — inlined when executing, shown as `*****` in output
- **`sensitive(value, n?)`** — inlined when executing, shows first `n` chars in output
- **Functions** — called at execution time (supports async). Used for request chaining.


## Environment Variables

With `useDotEnv`, your `.env` files are loaded into `process.env` automatically:

```
# .env
API_HOST=api.example.com

# .env.local
API_HOST=localhost:3000
TOKEN=dev-token-123
```

Use them in your definitions via `process.env`:

```typescript
const host = process.env.API_HOST
const token = process.env.TOKEN

export const getStuff = sling`
  GET https://${host}/stuff HTTP/1.1

  Authorization: Bearer ${token}
`
```

Switch environments with the CLI flag `--env`:

```bash
npx @slng/cli --file ./api.mts --env staging
```


## Secret Masking

### `secret(value)`

Completely hides the value in all output:

```typescript
import { secret } from '@slng/config'

export const auth = sling`
  POST https://api.example.com/auth HTTP/1.1

  Content-Type: application/json

  { "api_key": "${secret(process.env.API_KEY)}" }
`
```

In logs: `{ "api_key": "*****" }`
In the VS Code response panel: `{ "api_key": "●●●●●" }`

### `sensitive(value, n?)`

Shows the first `n` characters (default 6), masks the rest:

```typescript
import { sensitive } from '@slng/config'

sensitive("marvin.brouwer@gmail.com")     // "marvin.*****************"
sensitive("marvin.brouwer@gmail.com", 3)  // "mar********************"
```


## Request Chaining

Export a request, then reference its response in another:

```typescript
export const authenticate = sling`
  POST https://api.example.com/auth HTTP/1.1

  Content-Type: application/json

  { "token": "${secret(process.env.TOKEN)}" }
`

const getAuthToken = async () => {
  const res = await authenticate.response
  return res.json<{ auth_token: string }>().auth_token
}

export const getProfile = sling`
  GET https://api.example.com/profile HTTP/1.1

  Authorization: Bearer ${getAuthToken}
`
```

The `authenticate` request is executed lazily on first access to `.response` and cached — subsequent accesses reuse the same response.

**Important:** function interpolations (`${getAuthToken}`) are resolved at *execution* time, not at definition time. This means the function runs fresh each time you "Send" the request, but the upstream `.response` it depends on is cached per session.


## CLI Usage

```bash
# Run a specific export from a file
npx @slng/cli --file ./apis/users.mts "getUsers"

# Run all exports from a file
npx @slng/cli --file ./apis/users.mts

# Run all exports matching a glob
npx @slng/cli --files "./apis/*.mts"

# Auto-discover and run everything
npx @slng/cli

# With options
npx @slng/cli --file ./api.mts --env staging --verbose
npx @slng/cli --file ./api.mts --no-mask  # show real secret values (careful!)
```

Response bodies are written to stdout; status info goes to stderr. This means you can pipe:

```bash
npx @slng/cli --file ./api.mts "getUsers" | jq '.[] | .name'
```


## VS Code Extension

Install the Sling extension, then open any `.mts` file with sling exports.

### CodeLens

Above each `export const ... = sling\`...\`` you'll see:

```
▶ Send | 🐛 Debug
```

- **Send** — executes the request and shows the response in a side panel
- **Debug** — launches a Node.js debug session with a breakpoint at the definition

### Response Panel

The response panel shows:

- Status code and timing
- Response headers (in a tab)
- Response body (pretty-printed if JSON)
- Masked values shown as `●●●●●`

### Configuration

In VS Code settings:

- `slng.defaultEnvironment` — which environment to use (corresponds to your `useDotEnv` setup)
- `slng.maskSecrets` — toggle masking in the response panel (default: `true`)


## Debugging

When you click **Debug** in CodeLens:

1. A Node.js debug session starts with `tsx`
2. A breakpoint is set at the definition line
3. You can step through your code — interpolation functions, chaining logic, everything
4. When execution completes, the response appears in the panel

There's no hidden runtime magic. The debugger runs your actual `.mts` file with your actual code. You can inspect `process.env`, step into helper functions, and see exactly what goes over the wire.

You can also debug from the terminal:

```bash
node --inspect-brk ./node_modules/.bin/tsx ./apis/users.mts
```

Then attach VS Code's debugger.
