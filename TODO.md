## `.bind`

The `.bind` call signature is way too confusing.

> With no options the control type is auto-detected and the binding is two-way
> (user input flows back into the signal). With an options object, prop
> defaults to the auto-detected property and event is the write-back event;
> omit event for a one-way binding. A read-only getter (() => T) is also
> accepted as the source for a one-way derived value — pass it with options
> and omit event.
