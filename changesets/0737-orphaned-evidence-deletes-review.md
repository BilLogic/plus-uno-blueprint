# #737 owner-approved deletes: orphaned evidence

#794 deleted nine cells. Their nine evidence rows stayed, because evidence has
no foreign key to cells. The owner approved deleting exactly these rows on
November 1, 2026. Live values were re-read that day (reads only). Each row's
cell is gone, and these nine are the only evidence rows whose cell no longer
exists.

| Evidence | Title | Cell it was left on |
|---|---|---|
| `29c56946-9222-4ec8-84a6-a228f0763f48` | KB audit #752 row 29 — …00170303 | `…000000170303` |
| `240ea128-ab97-4b8a-8011-5a2e7adf9c94` | KB audit #752 row 29 — …00170304 | `…000000170304` |
| `526a287b-0dc6-41ac-a7ec-a79ceb3b6b59` | KB audit #752 row 29 — …00170306 | `…000000170306` |
| `579a2185-1439-44cf-b341-80af6bd263df` | KB audit #752 row 29 — …00170310 | `…000000170310` |
| `55ef1bc8-79a5-4814-9d3e-3733a9e9bd7c` | KB audit #739 row 56 — email | `…0000001f0701` |
| `2b9e5599-7db2-4f0c-8aa2-47413fbacb1b` | KB audit #739 row 56 — email | `…000000a00701` |
| `6e7895e7-03c5-4be6-87c3-485221fa50ce` | KB audit #739 row 56 — email | `…000000b00701` |
| `da37a6e6-060a-4000-b3dd-2135fab75bb6` | KB audit #739 row 56 — email | `…000000c00701` |
| `61870c32-59f5-4c31-aa78-52966aee7ab2` | KB audit #739 row 56 — email | `…000000d00701` |

## How

The runner gained `delete_evidence`. It calls the app's own
`evidenceMutations.deleteEvidence` as the dev authoring user, under the
`evidence_delete_auth` policy. It refuses while the cell still exists.

These deletes are not archived to the trash, because no trigger or RPC is
involved. Each one is recorded as an ordinary `delete_evidence` change in
`authoring_changes`, and its inverse, `restore_evidence_row`, carries the full
row. So unlike the cell deletes, each can be put back exactly.

## Dry-run, apply and verify (November 1, 2026)

| Mode | Result |
|---|---|
| Dry-run | `ok` twice, no failures, 9 entries, ledger 869→869 |
| Apply | 9/9, one `delete_evidence` change each, ledger 869→878 |
| Separate verify | `ok: true`, no failures |

Changeset SHA-256 `a8a1e67fecfc5e597ade1d163451361c5c4791fd5a42de94da69726359d75582`.
