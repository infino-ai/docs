# Infino documentation

Source for the Infino documentation site, served at **infino.ai/docs** and built
with [Mintlify](https://mintlify.com).

- Prose pages are plain `.md`; pages that use components (Quickstart, Install,
  landing) are `.mdx`.
- Concept / FAQ / tradeoffs prose is seeded from the
  [infino](https://github.com/infino-ai/infino) repo's `docs/`.
- The Rust API reference lives on [docs.rs/infino](https://docs.rs/infino); runnable
  examples live in the infino repo.

## Local preview

```sh
npm i -g mint
mint dev
```
