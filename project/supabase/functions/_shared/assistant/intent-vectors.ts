/* eslint-disable @typescript-eslint/no-explicit-any -- the runtime embedding session and Supabase query builder are untyped at this boundary. */
/**
 * Multilingual intent matching, for the five locales English keyword patterns cannot reach.
 *
 * Phase 3's prefetch matches English words, so a Tamil or Telugu question never matches and
 * pays a full model routing round (~3.4s measured) just to be told which tool to call. A
 * shared embedding space puts "எந்த பைக்குகள் விற்கப்படவில்லை" next to "which bikes are
 * unsold", which patterns cannot do at any level of effort.
 *
 * ## This can only ever add a prefetch
 *
 * A match seeds a tool result the model is free to ignore, so a misclassification costs one
 * read and some input tokens. It cannot change an answer. That is what makes a similarity
 * threshold an acceptable decision procedure here — it would not be if a miss produced a
 * wrong result rather than a slower turn.
 *
 * ## Degradation
 *
 * Every failure path returns null, which means "no prefetch" — precisely today's behaviour.
 * The embedding model is provided by the Supabase Edge Runtime; if it is unavailable on this
 * plan or runtime version, this module logs once and disables itself rather than throwing.
 */

import type { SupabaseClientLike } from "./types.ts";

/** gte-small's dimensionality. Must match the vector(384) column. */
const EMBEDDING_DIMENSIONS = 384;

/**
 * Cosine similarity above which a match is trusted.
 *
 * Deliberately high. Precision matters and recall does not: a missed match costs the
 * routing round we already pay today, while a false match costs a wasted query and pollutes
 * the model's context with irrelevant evidence.
 */
const SIMILARITY_THRESHOLD = 0.72;

/** Enough words to carry intent. Below this, embeddings of short fragments are noisy. */
const MIN_CHARS = 6;
const MAX_CHARS = 300;

interface EmbeddingSession {
  run(
    text: string,
    options: { mean_pool: boolean; normalize: boolean },
  ): Promise<number[]>;
}

let session: EmbeddingSession | null = null;
let sessionUnavailable = false;

/**
 * Lazily opens the runtime's embedding session.
 *
 * Absence is a supported outcome, not an error: the deployment target may not provide the
 * built-in model. Recorded once so the logs say so plainly instead of repeating per turn.
 */
function embeddingSession(): EmbeddingSession | null {
  if (session || sessionUnavailable) return session;
  try {
    // deno-lint-ignore no-explicit-any
    const runtime = (globalThis as any).Supabase;
    if (!runtime?.ai?.Session) {
      sessionUnavailable = true;
      console.warn(
        "Supabase.ai embedding session unavailable; multilingual intent matching is off " +
          "and non-English questions will use the model routing round",
      );
      return null;
    }
    session = new runtime.ai.Session("gte-small") as EmbeddingSession;
    return session;
  } catch (error) {
    sessionUnavailable = true;
    console.warn("Could not open the embedding session", error);
    return null;
  }
}

export async function embed(text: string): Promise<number[] | null> {
  const active = embeddingSession();
  if (!active) return null;
  try {
    const vector = await active.run(text, {
      mean_pool: true,
      normalize: true,
    });
    return Array.isArray(vector) && vector.length === EMBEDDING_DIMENSIONS
      ? vector
      : null;
  } catch (error) {
    console.error("Embedding failed", error);
    return null;
  }
}

/**
 * Fills in embeddings for any example rows that lack them.
 *
 * Seeded by migration as text only, because a migration cannot call a model. Runs at most
 * once per isolate and is safe to race: two isolates writing the same vector for the same
 * row converge on the same value.
 *
 * Bounded per call so a cold start cannot spend the turn's budget embedding reference data.
 * Whatever is left is picked up by the next turn.
 */
let backfillAttempted = false;
const BACKFILL_BATCH = 40;

export async function backfillExampleEmbeddings(
  client: SupabaseClientLike | null,
): Promise<void> {
  if (backfillAttempted || !client || !embeddingSession()) return;
  backfillAttempted = true;
  try {
    // deno-lint-ignore no-explicit-any
    const { data, error } = await (client as any)
      .from("assistant_intent_examples")
      .select("id, phrase")
      .is("embedding", null)
      .limit(BACKFILL_BATCH);
    if (error || !Array.isArray(data) || data.length === 0) return;

    for (const row of data as { id: number; phrase: string }[]) {
      const vector = await embed(row.phrase);
      if (!vector) return;
      // deno-lint-ignore no-explicit-any
      await (client as any)
        .from("assistant_intent_examples")
        .update({ embedding: vector })
        .eq("id", row.id);
    }
  } catch (error) {
    console.error("Intent example backfill failed", error);
  }
}

export interface IntentMatch {
  intent: string;
  similarity: number;
  /** Locale of the example that matched — useful for spotting cross-language drift. */
  matchedLocale: string;
}

/**
 * Nearest intent for a question, or null when nothing is confidently close.
 *
 * Null is the common and safe answer. It means the turn proceeds exactly as it does without
 * this module.
 */
export async function classifyIntent(
  client: SupabaseClientLike | null,
  message: string,
): Promise<IntentMatch | null> {
  const text = message.trim();
  if (!client || text.length < MIN_CHARS || text.length > MAX_CHARS) return null;

  const vector = await embed(text);
  if (!vector) return null;

  try {
    // deno-lint-ignore no-explicit-any
    const { data, error } = await (client as any).rpc(
      "match_assistant_intent",
      {
        query_embedding: vector,
        similarity_threshold: SIMILARITY_THRESHOLD,
      },
    );
    if (error || !Array.isArray(data) || data.length === 0) return null;
    const best = data[0] as {
      intent?: unknown;
      similarity?: unknown;
      locale?: unknown;
    };
    if (typeof best.intent !== "string") return null;
    return {
      intent: best.intent,
      similarity: typeof best.similarity === "number" ? best.similarity : 0,
      matchedLocale: typeof best.locale === "string" ? best.locale : "unknown",
    };
  } catch (error) {
    console.error("Intent match query failed", error);
    return null;
  }
}
