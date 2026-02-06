import sling, { useConfig, useDotEnv } from "@slng/config";

export default sling(
  // .env.dev get's precedence over useConfig
  useDotEnv('dev'),
  useConfig({
    dev: {
      app: 'testapp',
      profile: 'dev'
    }
  }),
);