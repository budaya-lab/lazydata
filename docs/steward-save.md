# Steward working draft and Save contract

Status: owner-approved simplification. Keep one working dataset object and serialize
it with `JSON.stringify`. Exact JSON formatting, string escapes and number notation
need not survive editing. This supersedes the lossless text-patch/journal design
and the earlier proposed server field/row protocol. Save/Reset remain disabled;
no writer, direct JSON input or dataset creation is implemented.

## Current browser model

```text
Descriptor text + revision
          |
          v
One working object <--- Metadata controls update its fields/arrays
          |
          +---> JSON.stringify(object, null, 2) + newline ---> JSON preview
          +---> Serialized draft ---> debounced metadata checks
          |
          v
Future Save { revision, text } ---> admission + conflict checks + guarded writer
```

`metadata-draft.ts` owns that object. `metadata-json.ts` handles strict admission,
numeric round-trip checks and serialization. There are no text edits, AST edits,
patch operation DTOs, original-offset calculations or cumulative change journal.
jsonc-parser 3.3.1 is used only as a bounded admission visitor, not as an editor.

The form sends current field/section values directly to the object. Do not build
a replacement document from only visible controls: retain unknown properties,
unsupported untouched values, saved counts and path-only licenses. Keep the
existing UI's row/tag IDs connected to their objects so removal does not attach
another entry's extra metadata. These references are not a second document.
Explicit field edits can replace supplied unsupported field values; unsupported
whole rows/containers are not silently converted into objects/arrays.

An explicit Resource path edit also commits the Name/Format filled by that action,
retaining manual overrides, even when counting is unsupported. Loaded missing
Name/Format remain blank instead of hiding absent metadata behind displayed
values; a missing required Name has an inline error. Count results remain
read-only and cannot determine whether metadata synchronizes. Empty strings/arrays
remain literal edits, not implicit property
deletion. Pending tag text participates. Partial dates keep their original stored
timestamp and show an error until representable; no date/time inference changes.
Failed edits leave the object unchanged and remain visibly unresolved until the
corresponding field/section is corrected. Never silently save an older value while
ignoring a visible failed/pending input.

`metadata-session.ts` owns the working draft and captured disk revision per selected
dataset. It is page-scoped, not an SSR-global singleton. Metadata stays mounted
across shallow Metadata/JSON switches. Form props derive from a stable saved-model
reference, not the wrapper replaced by edit notifications; otherwise Svelte can
reset local field state to saved values. Router loads cannot overwrite that draft
or advance its revision. Stale other-dataset callbacks are refused.

JSON preview and checks use the object's serialization. Pretty formatting may
change even when its values are unchanged; dirty tracking compares normalized
values, not source whitespace. Original disk text/revision remain the saved
baseline. Direct JSON visits before opening Metadata still show saved text.
Leaving/reloading changed drafts prompts before discarding them.

## Admission and limits

Before object editing, require strict object JSON with unique decoded keys, at
most 5 MiB, 128 container levels and 100,000 values. Refuse numbers whose source
decimal value differs from their JSON number reserialization, including rounding,
overflow, underflow and negative zero. Numeric tokens over 1,024 characters are
also refused. Do not silently round hidden metadata merely to open the form.
Numbers such as `1.2300e-9` can normalize to `1.23e-9` without changing their
serialized decimal value. Size-check normalized/edited JSON before committing it.

If admission fails, show the editing error and saved metadata issues; retain the
original JSON for viewing. Do not crash the page, synthesize an empty replacement,
or make unsupported document values look editable. Metadata policy issues alone
are different: incomplete metadata remains editable.

## Future direct JSON input

Not implemented. It must update this same working document, with the same Save
boundary. Admit a valid replacement before rebinding form models/row identities.
Retain invalid raw input visibly and prevent stale form actions from modifying it;
never invent a second form/raw Save protocol. Buffer behavior needs browser review
before enabling direct JSON entry or Save.

## One future server boundary

- Receive only `{ revision, text }` for the selected discovered dataset. Serialize
  the working object at submission. Revision identifies the loaded/acknowledged
  disk snapshot, not a local edit counter. Never take a destination from metadata.
- Bound the same-origin envelope and decoded text independently; escaping expands
  the body. Independently admit strict object JSON, unique keys, exact UTF-8 and
  document size/depth/value limits. Browser guards are not server authorization.
- Recompute shared metadata issues without reading resources/buckets, fetching
  URLs, counting, inferring defaults or timestamps. Metadata issues alone need not
  block saving valid candidate JSON. Form row caps are not global document caps.
- Write the exact admitted candidate text. The server must not rebuild it from
  visible fields or run another field/row serializer. Guard newer browser edits
  and issues from stale Save responses.

## Proposed persistence, still unimplemented

1. Serialize saves for the server-selected descriptor in process. Reuse bounded
   reads of an existing canonical regular single-link UTF-8 file and its directory.
2. Compare a fresh revision/identity with the submitted revision. Refuse detected
   conflicts; do not merge, force-overwrite or automatically retry.
3. Exclusively create an owned same-directory temporary file, write and sync the
   admitted text, preserving basic mode/ownership or refusing unsupported cases.
4. Recheck descriptor/directory identity and revision before atomic rename. Clean
   up only the owned temporary file on pre-commit failure.
5. Distinguish refusal, confirmed commit and uncertain/post-commit outcomes. Return
   a fresh revision and candidate issues without overwriting newer local edits.

Node rename is not compare-and-swap. External writers, multiple processes and
ancestor-swap races are not universally excluded. Basic permissions do not cover
ACLs, extended attributes or special flags. Review platform/preservation and
coordination limits before implementing the writer; do not claim an OS sandbox.

## Verification and next steps

Object-adapter tests replace obsolete byte-preservation/patch-protocol tests.
Cover sequential section edits, unknown properties, row/tag identity, pending
inputs, safe number conversion, atomic failure, size limits and owner isolation.
The browser-bundle/VM probe rejects Node built-ins and runs without Node globals;
it is portability evidence, not a DOM test. Owner confirmed synchronization and
field editing before this simplification; the new path still needs browser review.

Next: owner browser check, then separately implement/request-review guarded Save
using synthetic fixtures. No further dependency installation, CI/release changes,
real dataset writes or publication are authorized by this revision.
