// based on https://httpyac.github.io/guide/examples.html#argocd

import { sensitive, secret } from '@slng/config'

import sling from '../slng.config.mjs'
import constants from '../slng.constants.mjs'

const username = sensitive(sling.parameters.getRequired('USERNAME'), 3)
const password = secret(sling.parameters.getRequired('PASSWORD'))

export const session = sling`
  POST ${constants.host}/argocd/api/v1/session
  {
    "username": "${username}",
    "password": "${password}"
  }
`
