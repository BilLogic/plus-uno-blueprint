/**
 * Reference documents THIS deployment serves and the template does not — the
 * leaf half of the Q19 fork seam (#325 S2, #396 Q19).
 *
 * Why it is a file of its own rather than a row in `referenceDocs.ts`:
 * `referenceNames.ts` has to stay import-free of the documents. It is loaded
 * by `specs.ts`, which the eval harness bundles with rolldown — no Vite, so
 * no `?raw` — and one import from here to there would drag nineteen markdown
 * imports into a bundler that cannot resolve them. Names in a leaf, documents
 * behind Vite; that split is the whole reason for the second file.
 *
 * `referenceNames.ts` splices this in right after `canvas-adapter`, so the
 * shared vocabulary stays byte-identical to the template's copy and only this
 * list differs. In the template it is empty, which is the honest statement: a
 * template describes no particular service, so it has nothing to add.
 */
export const REFERENCE_NAMES_EXTRA: readonly string[] = ['blueprint']
