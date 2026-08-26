---
status: accepted
audience: developers
summary: The query cache is staleTime Infinity because nothing outside this app edits the data, which moves the whole burden of freshness onto every mutation.
---

# Reads never refetch on their own

`src/lib/queryClient.ts` sets `staleTime: Infinity`. Nothing refetches on focus,
on reconnect, or on an interval. A read happens once and the answer is kept.

The justification is a fact about the deployment, not about performance: **the
app is the only writer.** The deployed site is read-only, local writes go
through one authoring session, and the one other reader — the Slack bot — does
not write blueprint content. There is no third party to refetch away from.

## Consequences

**The entire burden of freshness moves onto the writer.** Every mutation must
invalidate, or the screen lies until reload. Scoped writes call
`invalidateQueries(prefix)`; any **structural** write calls
`invalidateStructure()`, which is one canonical key list rather than a
per-call-site subset — hand-rolled subsets drifted five ways before it existed,
and each drift presented as "the canvas did not update", which reads as a render
bug rather than a cache bug.

**A missed invalidation is invisible in review.** Nothing fails; the screen is
simply stale for one user in one session. That is the cost of the trade, and it
is why the invalidation call sits next to the write in every mutation module
rather than being inferred anywhere.

**If a second writer ever appears** — a second app surface, a bot that edits, a
webhook — this decision is the first thing to revisit. It is not a tuning
parameter; it is a claim about who writes.
