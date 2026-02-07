// based on https://httpyac.github.io/guide/examples.html#argocd

import sling from '../slng.config.mjs'
import constants from '../slng.constants.mjs'

import { sensitive, secret } from '@slng/config';

const username = sensitive(sling.parameters.getRequired('USERNAME'), 3)
const password = secret(sling.parameters.getRequired('PASSWORD'))

export const session = sling`
  POST ${constants.host}/argocd/api/v1/session
  {
    "username": "${username}",
    "password": "${password}"
  }
`

// json() returns a callable Accessor — use directly in templates
export const getSessionToken = session.json('token')