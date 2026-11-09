# 06: Reactive regions and reconciliation

**What to build:** A signal or function in child position becomes a
**reactive region** in the browser: when what it reads changes, the
region re-evaluates and the DOM follows. Structural changes are
reconciled by morphing the region's old nodes toward the new markup.
Children carrying a `key` attribute are matched by key and moved. Unkeyed
children are matched by position and tag name and patched in place. A
matching host is kept and its props rebound; it is never recreated.

Hosts are opaque: reconciliation never descends into a component host's
own markup. The only part of a host's subtree it enters is the marked
children range (`<!--[-->` ... `<!--]-->`), if the component emitted one.

This ticket works on DOM created by `mount` (ticket 05); adoption is 07.

**Blocked by:** 05

**Touches:** the browser templater module from ticket 05 (`mount`, region
tracking, morph), `test/index.ts`, `.size-limit.js` (raise the browser
templater entry to the measured result)

**Status:** done

- [x] A conditional region adds its content when its signal becomes
      truthy and removes it when falsy
- [x] A region whose value is plain text updates the text without
      replacing surrounding nodes
- [x] Reordering a keyed list moves the existing elements: each element
      is the same node (identity check) after the reorder
- [x] A host inside a keyed list keeps its identity across a reorder and
      is not disconnected and recreated
- [x] Adding and removing keyed items creates and removes only those
      items
- [x] Unkeyed children of the same tag at the same position are patched
      in place (same node, updated attributes)
- [x] A kept host has its props rebound to the new markup's values
- [x] Reconciliation leaves a host's own rendered markup untouched and
      does update content inside its children range
- [x] Dispose stops region updates
- [x] `npm test` and `npm run size` pass
