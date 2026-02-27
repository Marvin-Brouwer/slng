# `body-parser.json.ts`

Initially, colorizing JSON from a fetch request is rather simple. \
It looks something like this: \

```typescript
export function convertObjectToJsonAst(metadata: Metadata, value: unknown): JsonAstNode {
 if (value === null) return _null()
 if (value === undefined) return _null()

 if (typeof value === 'boolean') return boolean(value)
 if (typeof value === 'number') return number(value)
 if (typeof value === 'string') return string(value)
 if (isPrimitiveMask(value)) return jsonMask(metadata, value)

 if (Array.isArray(value)) return array(value.map(item => convertObjectToJsonAst(metadata, item)))

 if (typeof value === 'object') return object(Object
  .entries(value as Record<string, unknown>)
  .map(
   ([objectKey, objectValue]) => [
    convertObjectToJsonAst(metadata, objectKey),
    convertObjectToJsonAst(metadata, objectValue),
   ] as JsonObjectNodeEntry,
  ),
 )

 return unknown(value)
}
```

However, as described in [../readme.md](../readme.md), we don't want to maintain 2 implementations that do the same thing. \
Additionally, we'd like to support JSONC, and this allows us to do so. \

Lastly, the old approach lost indenting information, meaning we'd have to solve this ourselves in the display implementation.
