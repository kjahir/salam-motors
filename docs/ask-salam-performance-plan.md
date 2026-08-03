# Ask Salam: getting a response in a few seconds

Written 2026-08-03 against `staging`.

**Status: Phases 1-6 are built and deployed to staging. Phase 7 is a proposal.**
Production still runs the original code. Nothing here has been measured under real
concurrent load — the numbers below come from single traced turns.

## Baseline

Measured from a real failing run's execution trace, not estimated:

| Phase | Time | Source |
|---|---|---|
| Auth + context load | ~0.3s | small, unmeasured |
| Round 1 — choose a tool | **3.35s** | trace: round 1 elapsed |
| Tool execution | ~1s | unmeasured |
| Round 2 — write the answer | **~11.5s** | 2,763 visible tokens @ ~240 tok/s |
| **Total to first visible word** | **~16s** | |

Target: first word in ~2s, complete answer in ~5s.

## Measured after Phases 1-6

Same question ("explain this month's profit performance"), traced before and after. The
"after" column is a warm-cache run — the first run following a deploy is slower.

| | before | after |
|---|---|---|
| time to first token | 5,705ms | **2,049ms** |
| input tokens | 11,696 | 7,128 |
| of which cached | not recorded | **4,396** |
| output tokens | 3,200 (hit the cap, truncated) | ~1,000 |
| reasoning tokens | 389 | 29 |
| output cap hit | yes — turn failed | no |

The first-token target is met. Two things this exposed that were not in the original plan:

- **`get_finance_overview` was returning the whole ledger** so the model could add it up —
  44 rows, ~3,400 input tokens, to produce three subtotals. Now aggregated in Postgres,
  which is also why reasoning fell 389 → 29.
- **Forced-final rounds were shipped all 14 tool definitions** despite `tool_choice: "none"`
  making them uncallable — ~3,450 tokens of prefill per round for a capability the round
  did not have.

Prompt caching is fully effective: the ~4,900-token static prefix comes back cached, and
the uncached remainder is the per-request tool result, history and question. There is
nothing further to win there.

What remains is output generation — ~1,000 tokens at ~240 tok/s ≈ 4.4s — which is genuine
model work (metric labels, help text, follow-ups), not transcription hydration can remove.
Shortening it is a product decision about answer verbosity, not an optimisation.

## The finding that reframes everything

**The streaming is cosmetic.** `_shared/assistant/http.ts:141` awaits the entire turn, then
`:150` chops the finished string into 96-character chunks and emits them as `delta` events:

```ts
const result = await run(emitStatus);          // blocks for the whole turn
for (const text of answerChunks(result.turn.answer.text)) {
  write("delta", { text });                    // then fake-types a finished string
}
```

`requestResponses` (`openai.ts:252`) is a plain `fetch` + `await response.json()` — no
`stream: true`, so nothing streams from OpenAI either.

Users wait the full 16s on a spinner, then see a burst that resembles streaming.
**Time-to-first-word is identical to total turn time.**

The good news: `src/assistant/api.ts:203` already consumes the SSE body with a proper
reader loop and dispatches `status` / `meta` / `delta` / `turn` / `done`. The client is
ready for real streaming. This is almost entirely a server-side change.

## Phase 1 — Real streaming

**Perceived 16s → ~5s. No change to what the answer contains.**

`answer` is the 5th top-level property in generation order (`schemaVersion → turnId →
conversationId → locale → answer → blocks → followUps → provenance`), so the prose is
generated *before* the blocks. Streaming surfaces it almost immediately.

### Changes

1. **`requestResponses` gains a streaming mode.** Set `stream: true`, read the SSE body,
   and reduce OpenAI's events into the same `ResponsesEnvelope` we return today. Relevant
   events: `response.output_text.delta`, `response.output_item.added`,
   `response.function_call_arguments.delta`, `response.completed`, `response.incomplete`.

2. **Stream every `tool_choice: "auto"` round, not just the last.** We cannot know in
   advance whether a round will emit function calls or the final answer. The reducer must
   handle both: accumulate function-call arguments as before, and additionally expose the
   text delta stream for the answer case.

3. **Incremental extraction of `answer.text`.** Structured output arrives as one JSON
   string delivered in `output_text.delta` chunks. We need exactly one field out of it,
   early and in order — not a general streaming JSON parser. A tolerant scanner that
   locates `"answer"` → `"text"` → the opening quote, then emits characters until the
   unescaped closing quote, is sufficient and bounded. Everything after `answer` is ignored
   by the streamer and handled by the existing full parse at the end.

4. **`meta` must be emitted before the first delta.** It carries `runId`, and
   `http.ts:142` documents that speech playback starts on the first delta and needs the run
   id first. Today `meta` is written after `run()` resolves. The run id must be created and
   emitted *before* the model call. This is a required prerequisite, not an optional tidy.

5. **Fallback preserved.** If the stream errors, or the scanner never finds the field, fall
   back to today's behaviour — buffer the whole response, chunk it, emit. No regression path.

### Trace

Add `time_to_first_token_ms` to `model.round.completed`. Without it we cannot tell a fast
answer from a slow one that started early, and that distinction is the entire point.

### Consequence worth noting

**Streaming makes most of the reserve/degrade machinery obsolete.** The
`finalResponseReserveMs` split, `degradedToFinal`, and the forced-final round all exist
because a turn could burn its budget and produce nothing. Once tokens stream, a slow answer
still delivers words, and "produced nothing in 12.9s" becomes distinguishable from
"producing steadily but slowly." The deadline that matters becomes time-to-first-token, not
total wall clock.

Do not remove that machinery in Phase 1 — but revisit it immediately after, because it is
the direct cause of the double-attempt failure investigated on 2026-08-03, and streaming
removes its justification.

## Phase 2 — Stop making the model transcribe data it was handed

**Real 11.5s → ~3s. Also removes a hallucination class.**

The turn is requested with `strict: true` (`schemas.ts:271`, on the `MODEL_TURN_FORMAT`
wrapper — not on the schema objects themselves, which is easy to miss when searching).
OpenAI's strict structured outputs then impose two rules on every object: `additionalProperties:
false`, and `required` must list *every* property — optional properties are rejected.

`strictObject` (`schemas.ts:29`) is our helper that produces exactly that shape, which is why
it sets `required: Object.keys(properties)`. And because a property cannot be omitted, "this
vehicle has no variant" must be written as an explicit null — hence `nullableString` /
`nullableNumber` (`schemas.ts:4-5`).

Consequence: for **every** vehicle the model must emit all **21 fields**, including
`"variant": null, "odometer": null`. Twenty vehicles is 420 forced key/value emissions — of
data the server already holds in memory from the tool call it just ran. This is not the model
being verbose; the schema contract gives it no choice.

The model is acting as a slow, expensive JSON transcriber.

### The contract

The model emits only what it uniquely knows — which rows matter, and why:

```json
{ "type": "vehicle_collection", "title": "Ageing stock",
  "items": [{ "id": "v_123", "explanation": "92 days, ₹40k above market" }],
  "shown": 20, "total": 53 }
```

The server hydrates the remaining 20 fields. Output drops from ~2,763 tokens to ~800.

### Changes

1. **An evidence store that holds rows.** Today `evidence` is
   `Map<string, ToolEntity>` and `ToolEntity` is `{type, id, label}` (`types.ts:348`) —
   labels only, no field data. Phase 2 needs a parallel `Map<string, Record<string,
   unknown>>` capturing the full row at the point each tool builds its `entities` array
   (`tools.ts:390`, `:615`, `:821`, …). Memory is bounded by `maxToolCalls` × per-tool
   `limit`.

2. **A `hydrateBlocks(turn, rows)` pass**, run after `JSON.parse` and normalization,
   before `groundProvenance`. It mirrors the pattern `groundProvenance` already uses:
   canonicalize against server-held evidence, drop what cannot be matched.

3. **An unhydratable id is dropped**, exactly as `groundProvenance` drops unknown sources
   today (`openai.ts:379`). A model that invents a vehicle id gets an empty slot rather than
   a fabricated card. This is a correctness improvement, not just a speed one.

4. **The frontend does not change.** Hydration happens server-side before the turn is
   serialized, so the wire format `parseAssistantTurn` sees is identical.
   `AssistantBlocks.tsx` needs no edit. This is what makes Phase 2 tractable.

5. **Scope**: `vehicle_collection` and `alert_list` first — they are the large ones.
   `metric_grid` is model-computed and stays as is.

### Risk

The model loses the ability to editorialize per-field (e.g. restating a price with a
caveat). Keeping a model-authored `explanation` per item preserves the useful half of that.
Worth confirming no current answer style depends on per-field commentary.

## Phase 3 — Remove the routing round

**3.35s → ~0.3s.**

Round 1 exists solely to hear "call `search_inventory`". Options, in increasing ambition:

1. **Reasoning effort `none` on round 0.** 437 reasoning tokens to pick one tool is
   overhead. Cheapest possible change, likely worth ~0.5-1s on its own.
2. **Speculative execution.** Fire the highest-probability tool *in parallel* with the
   model call. If the model asks for the same tool with compatible arguments, the result is
   already in hand; otherwise discard it. Costs a wasted read query, saves a full round trip.
3. **Deterministic routing for the top question shapes.** A small classifier or pattern
   match over the ~10 most common intents, skipping the model round entirely.

(2) and (3) both need care around authorization: a speculatively-fired tool must run under
the same principal checks as a model-requested one, with no shortcut.

## Phase 4 — Small wins

- Order the prompt so OpenAI prompt caching hits the stable ~4KB instruction prefix. The
  instructions vary only by principal/locale/context, so the invariant part should lead.
- `maxOutputTokens` can drop once Phase 2 lands — smaller cap, faster failure detection.

## Phase 5 — Send the LLM less of the row

**Not a performance phase. This one is about what leaves the building.**

Phases 1-4 reduce what the LLM *writes*. This reduces what it *reads*. They are independent:
hydration does nothing for exposure, because the full tool result still goes out either way.

### What goes to OpenAI today

`openai.ts:926` serializes the entire `ToolResult` into the replay:

```ts
replay.push({ type: "function_call_output", call_id,
              output: JSON.stringify(item.result) });
```

Every row, every selected column. Exposure is therefore driven by each tool's `select`, not
by what the user asked. Two examples:

| Tool | Columns sent to OpenAI |
|---|---|
| `search_inventory` (`tools.ts:323`) | `registration_number` + 13 others, plus cost/profit when finance-visible |
| `search_parties` (`tools.ts:798`) | `full_name, mobile, email, city, state` |

A question as innocuous as "which bike has more expense" ships registration numbers for
every vehicle scanned, because the column is in the `select`.

Already in place: `store: false`, and `safety_identifier` is a salted hash rather than the
user id. Conversation history replays **text only** (`persistence.ts:214`) — past tool
results are not re-sent on follow-up turns.

### The change

Split every tool's output into two payloads:

- **`data`** — what the LLM sees. Reasoning fields only.
- **`display`** — retained server-side, never sent to OpenAI, used by Phase 2's hydration
  to fill the block the browser receives.

This composes exactly with Phase 2: the LLM references `v_123`, the server hydrates
`registration_number` from `display`. **The user still sees the registration number on the
card. The LLM never saw it.**

### Does this cost answer quality? It depends entirely on which fields you move

This is the part to get right. The fields fall into three groups, and they behave
differently:

**1. Pure identifiers — safe to withhold.** `registration_number`, `full_name`, `mobile`,
`email`. The LLM needs a stable id to reference a row; it does not need the registration
number to reason about ageing or price. Note that *searching* by registration still works:
the tool filters server-side with `.ilike` on the column (`tools.ts:331`), so the user's
query string is matched in Postgres and the column never needs to come back.

**2. Reasoning fields — withholding these does degrade answers.** `days_in_stock`,
`asking_price`, `status`, `manufacturer`, `model`, `variant`, `fuel_type`, `odometer`,
`manufacture_year`, cost and profit. The LLM ranks, filters, groups and explains using
these. Remove `variant` and it can no longer notice "these three are all the same variant
and all overpriced". Remove `fuel_type` and "which diesel bikes are ageing" silently
returns the wrong set.

The failure mode here is dangerous precisely because it is quiet: no error, just a blander
or wrong answer that reads fine. **Do not trim this group to save tokens.**

**3. Genuinely unused columns — free.** `created_at`, `consent`, internal flags nothing
reasons over.

So: groups 1 and 3 out, group 2 stays. That captures most of the PII reduction at close to
zero quality cost.

### The one real regression

**Voice answers lose spoken identifiers.** Step 8 synthesizes speech from `answer.text`. If
the LLM never sees registration numbers, it cannot put them in the prose, so they will not
be read aloud — they will only appear on the card. For "read out the registration numbers
of the ageing bikes", that is a genuine downgrade.

Mitigations: allow identifiers through for single-entity lookups (where the user has
already named the vehicle, so nothing new is disclosed), or accept prose that says "the 11
vehicles below" with the numbers rendered visually. Worth a product decision, not a
technical one.

### Sequencing

Phase 5 depends on Phase 2. Hydration must exist first, or withholding a column means the
browser cannot show it either — which *would* be a real loss of information to the user.

## Phase 6 — A narrower schema per intent

Every turn today is requested with the same `MODEL_TURN_FORMAT` (`schemas.ts:268`),
regardless of what was asked. "How many bikes are unsold" and "complete this sale" are
decoded against an identical 9,122-character grammar.

The envelope is genuinely fixed — `schemaVersion`, `turnId`, `conversationId`, `locale`,
`answer`, `followUps`, `provenance` appear in every turn. The variation lives in one place:

```
blocks.items.anyOf = [ metricBlock, vehicleBlock, alertBlock, timelineBlock,
                       confirmationBlock, receiptBlock, emptyBlock ]   // maxItems 24
```

So the decoder must permit all seven block types at all 24 positions, even when the question
could only ever produce one. A simple count carries the full confirmation and receipt
machinery it will never use.

### The change

Once Phase 3 knows the intent, select a format variant that narrows *only* the block union:

| Intent | Blocks offered |
|---|---|
| count / aggregate | `metric_grid`, `empty_state` |
| inventory listing | `vehicle_collection`, `empty_state` |
| compliance / alerts | `alert_list`, `empty_state` |
| vehicle history | `timeline`, `empty_state` |
| write / sale completion | `confirmation`, `action_receipt`, `empty_state` |
| unknown / low confidence | all seven (today's behaviour) |

### Why this is safe to try

**The wire format does not change.** Narrowing a union does not alter the envelope, so a
turn produced under a narrow variant is still a valid instance of the wide schema.
`parseAssistantTurn` and `AssistantBlocks.tsx` need no edit — the same property that makes
Phase 2 tractable.

**The prose is never constrained.** Only `blocks` narrows; `answer.text` stays free. If the
intent is misjudged, the worst case is a less rich block alongside a correct written answer —
not a wrong answer.

**`empty_state` is always included**, so the model always has a legal escape hatch when the
narrowed set genuinely does not fit.

### Cost and risk

- Each variant is a distinct schema and pays its own one-time grammar compile on first use.
  Give each a distinct `name`; expect a handful of slow first requests after deploy, then
  cached.
- Misrouting boxes the model out of the best block shape. This is a *quality* regression
  rather than a failure, but it is quieter than a slow answer and needs measuring — log the
  chosen variant on `model.round.started` so a bad mapping is visible in the trace.
- Only worth doing after Phase 3, since routing is what selects the variant. Before that
  there is nothing to select on.

### Expected gain

Smaller grammars decode faster and remove forced-null fields for blocks that cannot appear.
This is the smallest of the six levers — worth doing for answer-shape correctness as much as
for speed, and not worth doing on its own.

## Phase 7 — Classify intent with embeddings instead of keywords

**Proposal. Not built. The first change in this sequence that adds a real dependency
rather than rearranging what already exists.**

### The problem it solves

Phase 3's prefetch matches English keywords. Ask Salam supports six locales, so the other
five never match and pay the full routing round on every single question. No amount of
pattern-writing fixes that; a Tamil question shares no characters with an English one.

It also misses paraphrase. "How's the money looking" contains none of the finance keywords
but means exactly what "explain this month's profit performance" means.

### What embeddings can and cannot do here

**Can**: say "this is a finance question" across languages and phrasings, because a
multilingual embedding places "which bikes are unsold" and "எந்த பைக்குகள்
விற்கப்படவில்லை" near each other.

**Cannot**: produce arguments. Similarity yields a label, not `date_from=2026-08-01` or
`vehicle_id=<uuid>`. For "Swifts under 5 lakh with under 50,000 km" the intent is obvious
to a vector and the filters are not.

So this replaces the *regex layer*, not the model round. The model round remains the
fallback for everything below the similarity threshold, exactly as it is the fallback for
an unmatched regex today.

### Why coarse arguments are acceptable

The prefetch is a guess the model can override. A vector says `search_inventory`, we seed
it with defaults, and if the user actually wanted a price filter the model calls the tool
again properly. One wasted read, no wrong answer.

That means the classifier only has to be right about the *shape* of the question, never the
details — a much lower bar than routing normally demands, and the reason keyword matching
was acceptable in the first place.

### Shape

- `create extension vector`, plus a table of labelled example questions per intent.
- Embed the incoming question. Two options, and the choice matters:
  - **Supabase Edge Runtime's built-in model** (`Supabase.ai.Session`) — local, ~10-50ms,
    nothing leaves the infrastructure. **Verify availability on the current plan and
    runtime version before designing around it**; this has not been checked.
  - **An OpenAI embedding call** — ~100-300ms round trip. No new exposure, since the
    question text already goes to OpenAI, but it is a network hop on the critical path.
- Nearest neighbour over the example table, with a threshold. Below it, fall through to the
  model round.
- Log the matched intent and its distance on the trace, so a drifting threshold is visible.

Adding an intent becomes "write ten example questions" rather than "write a regex", which
is easier to get right and easier to get right in six languages.

### Whether it is worth doing

**This hinges on one number nobody has: how much real traffic is non-English.**

If most questions are English, regex already handles them at zero cost and this is a lot of
machinery for paraphrase coverage. If Tamil/Hindi/Kannada usage is material, those users pay
~3.4s on every question today and this is the largest remaining win available to them —
larger than anything left on the English path.

`response_locale` is now recorded on every round, so this is answerable from traffic rather
than from assumption. Do that first.

### Costs to weigh

- New extension, new table, labelled data to maintain.
- A similarity threshold is a tuning parameter that drifts; a misclassification is silent,
  though recoverable for the same reason regex misses are.
- If the embedding is an API call, it is a network dependency on the critical path of every
  turn — including the English ones that regex already handles for free. Worth keeping regex
  as a fast path ahead of it rather than replacing it outright.

## Projected

| | first word | complete |
|---|---|---|
| today | ~16s | ~16s |
| + Phase 1 | ~5.5s | ~16s |
| + Phase 2 | ~5.5s | ~8s |
| + Phase 3 | **~2s** | **~5s** |

Phase 5 also trims input tokens, which shortens step 5's prefill — a secondary speed benefit,
not the reason to do it.

Phase 1 delivers most of the *felt* improvement for the least risk. All three are needed to
be genuinely fast.

## Sequencing

Ship Phase 1, measure `time_to_first_token_ms` on real traffic, then reassess. Phases 2 and
3 are independent of each other and both depend only on Phase 1's measurement, not its code.

Phase 5 is the one hard ordering constraint: it **must** follow Phase 2. Without hydration,
withholding a column from the LLM also withholds it from the browser.

Phase 6 has the same kind of constraint: it must follow Phase 3, because routing is what
selects the schema variant.

Phase 7 replaces Phase 3's classifier, so it depends on Phase 3 existing — and on locale
numbers from real traffic, which is the actual gate.

```
Phase 1 (streaming) ─┬─> Phase 2 (hydration) ──> Phase 5 (send less)
                     └─> Phase 3 (routing)   ─┬─> Phase 6 (narrow schema)
                                              └─> Phase 7 (embed intent)   [proposal]
```

Phases 4, 5 and 6 are all optimisations of a working system. Phases 1-3 are where the
latency actually is.

## Open questions

1. Does any current answer style depend on per-field model commentary that a
   `{id, explanation}` contract would lose?
2. Should Phase 1 also revisit the reserve/degrade logic, or land streaming first and treat
   that as a follow-up? (Recommendation: follow-up — one behavioural change at a time.)
3. Is a wasted speculative read acceptable against production Supabase load, or should
   Phase 3 stop at deterministic routing?
4. Phase 5: should identifiers be allowed through for single-entity lookups, where the user
   has already named the vehicle and nothing new is disclosed? This is what decides whether
   voice answers can still speak a registration number.
5. Phase 5: is the driver here compliance/DPDP obligation, or general caution? A hard
   obligation may justify accepting the voice regression outright; general caution probably
   does not.
6. Phase 6: how many intent variants are worth maintaining? Each is a schema to keep in sync
   with the frontend renderer, and the table above is a guess at the real question mix — the
   trace now records enough to derive it from actual traffic instead.
7. Phase 7, and the gate on the whole thing: **what share of real questions are not in
   English?** `response_locale` is on every round now. If the answer is "almost none",
   Phase 7 is not worth its dependencies; if it is material, it is the biggest remaining win
   for those users.
8. Phase 7: is the Supabase Edge Runtime embedding model actually available here? A local
   model at ~10-50ms and an OpenAI call at ~100-300ms lead to different designs — the second
   puts a network hop on the critical path of every turn, including English ones that regex
   already answers for free.
