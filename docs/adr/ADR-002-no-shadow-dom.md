# ADR-002: No Shadow DOM

**Date:** 2026-06-28

## Context

A custom element may attach a shadow root for style and markup
encapsulation. microtags targets pages whose markup is produced by a
server and then hydrated: the children a component needs, such as the
elements carrying `data-ref`, already exist in the document before any
JavaScript runs. Shadow DOM would require either declarative shadow DOM
in the server output or client-side template stamping, and it breaks
global CSS, form participation, and some assistive-technology behaviour.

## Decision

Components never create a shadow root, and the library offers no option
to. Behaviour attaches to the host's light-DOM children. Refs resolve with
`querySelector` against the host. Styling is ordinary global CSS scoped
by the host tag name.

## Consequences

Server rendering is plain HTML: the server emits the host and its
children, the browser upgrades the host and runs `setup`. Global styles
apply without workarounds.

There is no style encapsulation; authors namespace selectors under the
host tag. A component cannot create the children it depends on, so a
missing single ref throws at connect time rather than being silently
created. This constraint is what makes the single-file render design in
ADR-005 necessary: the markup has to be authored somewhere on the server.
