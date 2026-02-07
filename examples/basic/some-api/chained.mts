import sling from "../slng.config.mjs";
import { secret, sensitive } from "@slng/config";

const apiHost = "api.example.com";
const apiToken = sling.parameters.getRequired('TOKEN');

// Step 1: Authenticate
// CodeLens: ▶ Send | 🐛 Debug
export const authenticate = sling`
  POST https://${apiHost}/auth HTTP/1.1
  Content-Type: application/json

  {
    "token": "${secret(apiToken)}"
  }
`;

// Step 2: Use the auth token in a subsequent request
// json() returns a callable Accessor — no wrapper function needed
// CodeLens: ▶ Send | 🐛 Debug
export const getProfile = sling`
  GET https://${apiHost}/profile HTTP/1.1
  Authorization: Bearer ${authenticate.json("auth_token")}
  Accept: application/json
`;

// Example with sensitive data (partially masked)
// CodeLens: ▶ Send | 🐛 Debug
export const updateEmail = sling`
  PATCH https://${apiHost}/profile HTTP/1.1
  Authorization: Bearer ${authenticate.json("auth_token")}
  Content-Type: application/json

  {
    "email": "${sensitive("marvin.brouwer@gmail.com")}"
  }
`;
