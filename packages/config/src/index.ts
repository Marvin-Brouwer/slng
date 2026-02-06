// Main factory
export { sling } from "./sling.js";
export { sling as default } from "./sling.js";

// Plugins
export { useDotEnv } from "./plugins/dotenv.js";

// Masking utilities
export { secret } from "./masking/secret.js";
export { sensitive } from "./masking/sensitive.js";

// Runtime utilities (for CLI / extensions)
export { isSlingDefinition } from "./definition.js";
export {
  parseHttpText,
  resolveInterpolation,
  resolveInterpolationDisplay,
  assembleTemplate,
  SlingParseError,
} from "./parser.js";

// Types
export type {
  SlingDefinition,
  SlingResponse,
  SlingInterpolation,
  SlingContext,
  SlingPlugin,
  ConfiguredSling,
  MaskedValue,
  ExecuteOptions,
  ParsedHttpRequest,
} from "./types.js";
