

export type SlingParameters = Record<string, unknown | undefined> & {
  get<T extends boolean | number | string = string>(key: string): T | string | undefined
  getRequired<T extends boolean | number | string = string>(key: string): T | string
}

export type ParameterType = string | number | boolean;

export type SlingParameterDictionary = SlingParameters & {
  set(key: string, value: string): void
}

// TODO Document, add a note the T doesn't change the type at all.
// TODO add missing tests
export function createSlingParameters(initial?: Record<string, ParameterType | undefined>): SlingParameterDictionary {

  const parameters: Record<string, ParameterType | undefined> = initial ?? { };

  function set(key: string, value: string) {
    parameters[key] = value;
  }

  function get<T>(key: string) {
    const value = parameters[key];
    if (!value) return undefined;

    return value as T;
  }

  function getRequired<T>(key: string) {
    const value = get<T>(key);
    if (!value) throw new Error(`Required parameter '${key}' was not loaded.`);
    return value;
  }

  return Object.assign({}, parameters, { get, getRequired, set })
}