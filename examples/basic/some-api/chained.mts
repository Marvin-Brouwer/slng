import s from '../slng.config.mts'

const apiHost = 'api.example.com'
const apiToken = s.secret(s.parameters.getRequired('TOKEN'))

// Step 1: Authenticate
// CodeLens: ▶ Send | 🐛 Debug
export const authenticate = s.http`
  POST https://${apiHost}/auth HTTP/1.1
  Content-Type: application/json

  {
    "token": "${apiToken}"
  }
`

// Step 2: Use the auth token in a subsequent request
// json() returns a ResponseDataAccessor — resolved lazily by the template
// CodeLens: ▶ Send | 🐛 Debug
export const getProfile = s.http`
  GET https://${apiHost}/profile HTTP/1.1
  Authorization: Bearer ${authenticate.json('auth_token')}
  Accept: application/json
`

// Example with sensitive data (partially masked)
// This is mostly useful when copying the responses directly into emails and such
// CodeLens: ▶ Send | 🐛 Debug
export const updateEmail = s.http`
  PATCH https://${apiHost}/profile HTTP/1.1
  Authorization: Bearer ${authenticate.json('auth_token')}
  Content-Type: application/json

  {
    "email": "${s.sensitive('marvin.brouwer@gmail.com')}"
  }
`
