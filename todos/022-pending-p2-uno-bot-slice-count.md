# 022 · P2 · uno-bot reports page size as slice total

Found by live smoke test 2026-08-08 (DM D0APTB20SK0, devoli workspace):
asked "how many slices does the blueprint have" — bot answered **5**; the
database has **14**. Its newest-slice answer (title, date, deep link) and
its Warm-Up sequence answer (Mark present → triggers → Select engagement
level, with cell deep links) were verified exactly correct against the DB.

Root cause (read from the deployed Worker bundle, account
Bryanhuang628 / worker `uno-bot`, modified 2026-08-07):
`fetchSlices` → `fetchRows(env, "slices", filter, 10)` — a capped page,
further narrowed by `title/actor ilike` terms from the user's question,
with NO total count returned. Nothing tells the model the page is
partial, so a "how many" question gets the page size.

Fix (in the bot's own repo/session — local checkouts here are stale, r7
vs deployed ~r54):
- Request `Prefer: count=exact` on the slices read (PostgREST returns
  `Content-Range`), pass `total` alongside the rows, and render the tool
  result as "showing N of TOTAL slices" — same for findings/edges reads
  if they share the fetchRows cap.
- Or add a cheap dedicated count read when the question is a count.

Note: the bot's source situation itself is a risk — the deployed r54 has
no complete local checkout (see PLUS-UNO/_archive/uno-bot-r9-recovery/
README). Pulling the current source back under version control is the
real prerequisite for any bot fix.
