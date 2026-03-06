// based on https://httpyac.github.io/guide/examples.html#argocd

import s from '../slng.config.mts'
import constants from '../slng.constants.mts'

const username = s.sensitive(s.parameters.getRequired('USERNAME'), 3)
const password = s.secret(s.parameters.getRequired('PASSWORD'))

export const session = s.http`
  POST ${constants.host}/argocd/api/v1/session
  {
    "username": "${username}",
    "password": "${password}"
  }
`
