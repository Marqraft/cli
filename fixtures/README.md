# Shared content fixtures

`content/*.md` are page bodies in Marqraft's source format. `content/*.html`
are the authoring HTML Kex renders for them (`spec/fixtures.spec.kex`), which
the frontend parses and serializes back (`frontend/src/fixtures.test.ts`).
Together they check that both sides read the format the same way and that
untouched source survives an editor round trip byte for byte.

After an intentional rendering change, delete the `.html` file and run
`tey test` to regenerate it, then review the diff.
