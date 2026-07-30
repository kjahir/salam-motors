/* TEMPORARY visual-preview harness — delete with the rest of src/__preview__. */
function builder() {
  const result = { data: [], error: null };
  const chain: Record<string, unknown> = {
    select: () => chain, eq: () => chain, is: () => chain, order: () => chain, in: () => chain,
    single: async () => ({ data: null, error: null }), maybeSingle: async () => ({ data: null, error: null }),
    insert: () => ({ select: () => ({ single: async () => ({ data: { id: "n1" }, error: null }) }), then: (r: (v: unknown) => void) => r({ data: null, error: null }) }),
    update: () => ({ eq: async () => ({ data: null, error: null }) }),
    delete: () => ({ eq: async () => ({ data: null, error: null }) }),
    then: (resolve: (v: unknown) => void) => resolve(result),
  };
  return chain;
}
export const supabase = {
  from: () => builder(), rpc: async () => ({ data: true, error: null }),
  storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: "" }, error: null }), upload: async () => ({ error: null }), remove: async () => ({ error: null }) }) },
} as unknown as typeof import("@/lib/supabase").supabase;
