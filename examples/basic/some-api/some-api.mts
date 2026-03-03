import sling from '../slng.config.mjs'

const apiHost = 'jsonplaceholder.typicode.com'
const apiToken = sling.secret(sling.parameters.getRequired('TOKEN'))

// CodeLens: ▶ Send | 🐛 Debug
export const getUsers = sling`
  GET https://${apiHost}/users HTTP/1.1
  Accept: application/json
`

// CodeLens: ▶ Send | 🐛 Debug
export const getUser = sling`
  GET https://${apiHost}/users/1 HTTP/1.1
  Accept: application/json
`

// TODO, validate no whitespace between anything but body
// CodeLens: ▶ Send | 🐛 Debug
export const createUser = sling`
  POST https://${apiHost}/users HTTP/1.1
  Content-Type: application/json
  Authorization: Bearer ${apiToken}

  {
    "name": "Marvin Brouwer",
    "email": "${sling.sensitive('marvin.brouwer@gmail.com')}"
  }
`
