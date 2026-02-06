// based on https://httpyac.github.io/guide/examples.html#argocd

import sling from '../slng.config.mjs'
import constants from '../slng.constants.mjs'

import { getSessionToken } from './session.slng.mjs'

export const getApplications = sling`
  GET ${constants.host}/argocd/api/v1/applications
  Authorization: Bearer ${getSessionToken}
`

export const createApplication = sling`
  POST ${constants.host}/argocd/api/v1/applications
  Authorization: Bearer ${getSessionToken}

  {
    "metadata": {
      "name": "{{app}}",
      "namespace": "argocd"  
    },
    "spec": {
      "source": {
        "repoURL": "https://github.com/httpyac/argocd.git",
        "path": "argocd/{{app}}",
        "targetRevision": "{{revision}}",
        "helm": {
          "valueFiles": ["values-{{profile}}.yaml","values.yaml"]
        }
      },
      "destination": {
        "server": "https://kubernetes.default.svc",
        "namespace": "argocd"
      },
      "project": "default",
      "syncPolicy": {
        "automated":{}
      }
    }
  }
`