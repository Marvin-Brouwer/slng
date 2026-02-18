# Http AST

Because we need to intermix the HTTP request with masked values, and, we need to colorize the response later anyway, we have an AST setup.

This setup exists of 3 parts:

1. `http-parser.request` \
   A basic parser to convert the StringTemplates to our AST
1. `http-builder.response` \
   A utility that converts an HTTP response object from node to our AST format
1. `http-parser/*.ts`
   TBD, http content parsers for both request an response bodies.

## Requests

The requests are built from the `ResolvedStringTemplate`, a combination of strings and Masked values. 

In no situation **EVER** may the masked values make it into the AST. \
We store the values in the metadata and keep a reference to there. \
_The same goes for any body parsers_
