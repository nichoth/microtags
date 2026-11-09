# ADR-003: Standard Schema for prop validation

**Date:** 2026-06-28

## Context

Attribute values arrive as strings and need coercion, and some props need
validation beyond the four builtins (`number`, `string`, `boolean`,
`json`). nanotags accepts a custom schema object as a prop definition.
Bundling a validator, or writing one, would add bytes to every consumer
and tie the library to one validation ecosystem.

## Decision

`p.schema(validator)` accepts any object implementing the Standard Schema
V1 interface. microtags calls only `~standard.validate` and depends on
`@standard-schema/spec` for types alone. Validation is synchronous; an
async schema throws. A failed validation yields `undefined` rather than
throwing. The four builtins remain plain coercer functions, not schemas.

## Consequences

Zod, Valibot, ArkType, and any future Standard Schema library work with
no adapter, and the library ships no validator. There is no `p.oneOf`;
an enum is a schema.

The validator input is always the raw attribute string or `null`, so
schemas for non-string values must coerce (for example `z.coerce.number()`
rather than `z.number()`). Failures are silent, so authors guard for
`undefined` or fold a default into the schema.
