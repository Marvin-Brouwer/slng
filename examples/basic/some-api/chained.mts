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

// Helper: extract auth token from the authenticate response
const getAuthToken = () => authenticate.json("auth_token");

// Step 2: Use the auth token in a subsequent request
// CodeLens: ▶ Send | 🐛 Debug
export const getProfile = sling`
  GET https://${apiHost}/profile HTTP/1.1
  Authorization: Bearer ${getAuthToken}
  Accept: application/json
`;

// Example with sensitive data (partially masked)
// CodeLens: ▶ Send | 🐛 Debug
export const updateEmail = sling`
  PATCH https://${apiHost}/profile HTTP/1.1
  Authorization: Bearer ${getAuthToken}
  Content-Type: application/json

  {
    "email": "${sensitive("marvin.brouwer@gmail.com")}"
  }
`;
