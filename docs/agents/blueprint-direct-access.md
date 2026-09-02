---
audience: agents
summary: Query recipes and service-key notes for agents that read the blueprint's database directly rather than through the portal — the supplement to blueprint.md, never a restatement of it.
sources: src/lib/blueprintContract.ts, docs/engineering/access-and-security.md
---

# Direct access to the blueprint

The supplement to [`blueprint.md`](blueprint.md), for an agent holding a
project URL and a key. Read that first; this adds the shapes of the calls.

## With the anon key

Every relation listed as readable in `blueprint.md` answers a bare select:

```
GET /rest/v1/cells?select=id,cell_key,content,summary,status,position&path_id=eq.<path id>&order=position
GET /rest/v1/paths?select=id,name,kind,status,summary&scenario_id=eq.<scenario id>
GET /rest/v1/cell_touchpoints?select=id,cell_id,touchpoint_id,name,summary,role&cell_id=eq.<cell id>
GET /rest/v1/resources?select=id,cell_id,cell_touchpoint_id,kind,name,url,featured&cell_id=eq.<cell id>
```

Edges embed through their constraint names — the strings PostgREST resolves,
which `src/lib/blueprintContract.ts` declares and `check:contract:live` probes:

```
GET /rest/v1/cell_dependencies?select=kind,name,source:cells!cell_dependencies_source_cell_id_fkey(id,content),target:cells!cell_dependencies_target_cell_id_fkey(id,content)
```

The portal takes the same key:

```
POST /rest/v1/rpc/search_blueprint
{"q": "what happens when a session is missed", "match_count": 15, "granularity": ["cell"]}
{"filter_path_kind": "exception", "granularity": ["path"]}
```

The catalog itself is reachable through two functions, because PostgREST
exposes `pg_catalog` to no role: `rpc/value_sets` returns every CHECK and
domain as deparsed, `rpc/schema_comments` every table and column comment.

## With a service key

`evidence` is restricted — excerpts may hold interview content — and the
`semantic_search` schema (`blueprint_chunks_src`, `match_corpus_chunks`) is
`service_role` only. A service key reads both; it belongs on a developer
machine or a runner, and stays out of this repository and its workflows.
Writes go through the authoring RPCs as an `authenticated` session whose JWT
carries `app_metadata.role = "service"` — `is_service_account()` is the guard
every structural write checks first — and every write is recorded in
`authoring_changes` by `record_authoring_change`. The full posture, table by
table, is in
[`docs/engineering/access-and-security.md`](../engineering/access-and-security.md).
