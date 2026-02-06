import sling, { useDotEnv } from "@slng/config";

export default sling(
  useDotEnv("local", "staging"),
);
