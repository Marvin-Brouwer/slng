import sling, { useDotEnv } from "@slng/config";

// TODO use the dir location of this file instead of process.cwd
// Maybe this api is better:
/* 
 * 
 * ```ts
 * export default sling(
 *  useDotEnv({ dir: import.meta.dirname, environments: ["local", "staging"] }),
 * );
 * ```
 */

export default sling(
  useDotEnv("local", "staging"),
);


