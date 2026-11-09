# 05: Hosts survive same-tick moves

**What to build:** A host that is disconnected and reconnected in the
same tick, which is what `insertBefore` does in browsers without
`moveBefore`, keeps its setup state: cleanups do not run and setup does
not run again. The host tracks whether it is live (connected and not
torn down). The connected callback returns early when the host is
already live. The disconnected callback queues a microtask; when it
runs, teardown happens only if the host is still not connected.
Teardown runs the cleanups once and marks the host not live; a second
queued microtask for a host already torn down does nothing.
`connectedMoveCallback` stays empty.

This changes observable timing: after a real removal, cleanups run on
the next microtask instead of synchronously. Existing tests that assert
cleanup right after removal await a microtask first. The glossary entry
for Setup and the README's setup/lifecycle text say cleanup happens
after a microtask, so a move keeps state.

Because every host in both examples is affected, run every suite after
this change and check the size entries for core and the browser
templater. If a limit must rise, the new limit is the measured size
rounded up to the next 0.05 kB, recorded in the size file's comment.

**Blocked by:** None (can start immediately)

**Touches:** `src/factory.ts` (`connectedCallback`,
`disconnectedCallback`, a liveness field on `MicrotagElement`),
`CONTEXT.md` (the **Setup** entry), `README.md` (the `.setup` section
and the `ctx` methods table rows that say "on disconnect"),
`.size-limit.js`, `test/index.ts` (every existing disconnect and
cleanup test). Give each new test its own tag name.

**Status:** done

- [x] Browser suite: with the parent's `moveBefore` shadowed by
      `undefined`, reordering a keyed list of hosts through a region
      runs setup once per host and a signal created in setup keeps its
      value after the reorder.
- [x] Browser suite: moving a host with `insertBefore` directly, then
      awaiting a microtask, runs no cleanups.
- [x] Browser suite: after a real removal and `await Promise.resolve()`,
      cleanups have run exactly once.
- [x] Browser suite: removing a host twice before the microtask runs
      the cleanups once.
- [x] Browser suite: reconnecting a host after its teardown runs setup
      again (the existing second-connect behaviour still holds).
- [x] All existing disconnect and cleanup tests pass after awaiting a
      microtask.
- [x] `npm run size` passes, with any raised limit recorded in the size
      file's comment.
