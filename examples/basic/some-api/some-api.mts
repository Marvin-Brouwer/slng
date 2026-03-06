import s from '../slng.config.mts'

const apiHost = 'jsonplaceholder.typicode.com'
const apiToken = s.secret(s.parameters.getRequired('TOKEN'))

// CodeLens: ▶ Send | 🐛 Debug
export const getUsers = s.http`
  GET https://${apiHost}/users HTTP/1.1
  Accept: application/json
`

// CodeLens: ▶ Send | 🐛 Debug
export const getUser = s.http`
  GET https://${apiHost}/users/1 HTTP/1.1
  Accept: application/json
`

// TODO, validate no whitespace between anything but body
// CodeLens: ▶ Send | 🐛 Debug
export const createUser = s.http`
  POST https://${apiHost}/users HTTP/1.1
  Content-Type: application/json
  Authorization: Bearer ${apiToken}

  {
    "name": "Marvin Brouwer",
    "email": "${s.sensitive('marvin.brouwer@gmail.com')}"
  }
`
