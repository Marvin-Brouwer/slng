// based on https://httpyac.github.io/guide/examples.html#argocd

import s from '../slng.config.mts'
import constants from '../slng.constants.mts'

import { session } from './session.slng.mts'

export const getApplications = s.http`
  GET ${constants.host}/argocd/api/v1/applications
  Authorization: Bearer ${s.secret(session.json('token'))}
`

export const createApplication = s.http`
  POST ${constants.host}/argocd/api/v1/applications
  Authorization: Bearer ${s.secret(session.json('token'))}

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
