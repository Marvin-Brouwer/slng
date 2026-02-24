# `sling.json` 

This "grammar" is mostly there to immediately flag sling as it's own grammar provider.
It does nothing though, the actual parsing will be done with Language providers

An important part is this line in `#template-expression`:

```json
"patterns": [
	{ "include": "source.ts" }
]
```

It makes sure colorizing falls back to the original document when inside of a template expression.
