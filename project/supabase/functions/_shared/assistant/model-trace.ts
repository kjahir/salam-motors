/**
 * Shapes the model exchange for the execution trace.
 *
 * This module used to record only sizes — "item 4 is a user message of 63 characters" —
 * which made step 3 of the Audit page unreadable: you could see that a tool batch was
 * planned but never why, because neither the prompt nor the model's answer was anywhere in
 * the trace. It now retains content verbatim. `assistant_trace_events` is admin-gated
 * (owner/manager RLS), and that gate — not omission at the source — is what protects this.
 *
 * Still deliberately excluded: model hidden reasoning (requested as
 * `reasoning.encrypted_content`, opaque to us in any case), credentials, and action tokens.
 * `sanitizeTraceDetails` in persistence.ts remains the backstop for those.
 */
interface TraceItem {
  index: number;
  type: string;
  role?: string;
  call_id?: string;
  content_type?: string;
  content_characters?: number;
  /** The message text itself. Absent when the item carries no text (e.g. reasoning items). */
  content_text?: string;
  tool_name?: string;
  /** Parsed tool arguments, values included. */
  arguments?: Record<string, unknown>;
  /** The raw string, kept only when it would not parse as JSON — a real failure mode. */
  arguments_unparsed?: string;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;
}

function partsText(content: readonly unknown[]): string {
  return content.map((part) => {
    const partRecord = record(part);
    return typeof partRecord?.text === "string" ? partRecord.text : "";
  }).join("");
}

export function traceModelItems(items: readonly unknown[]): TraceItem[] {
  return items.slice(0, 40).map((value, index) => {
    const item = record(value);
    if (!item) return { index, type: typeof value };
    const content = item.content;
    const summary: TraceItem = {
      index,
      type: typeof item.type === "string"
        ? item.type
        : typeof item.role === "string"
        ? "message"
        : "object",
    };
    if (typeof item.role === "string") summary.role = item.role;
    if (typeof item.call_id === "string") summary.call_id = item.call_id;
    if (typeof item.name === "string") summary.tool_name = item.name;
    if (typeof content === "string") {
      summary.content_type = "text";
      summary.content_characters = content.length;
      summary.content_text = content;
    } else if (Array.isArray(content)) {
      const text = partsText(content);
      summary.content_type = "parts";
      summary.content_characters = text.length;
      if (text) summary.content_text = text;
    }
    // A function_call_output carries its payload in `output`, not `content`, so it read as
    // an empty item — leaving the trace silent about the one input that most determines how
    // expensive the next round is. A round that has to summarize 50 vehicle records is not
    // doing the same work as one that got three, and nothing in the timeline said which.
    if (typeof item.output === "string") {
      summary.content_type = "tool_result";
      summary.content_characters = item.output.length;
      summary.content_text = item.output;
    }
    if (typeof item.arguments === "string") {
      const parsed = record(safeParse(item.arguments));
      if (parsed) summary.arguments = parsed;
      else summary.arguments_unparsed = item.arguments;
    }
    return summary;
  });
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function modelToolNames(tools: readonly unknown[]): string[] {
  return tools.flatMap((value) => {
    const tool = record(value);
    if (!tool) return [];
    if (typeof tool.name === "string") return [tool.name];
    const fn = record(tool.function);
    return typeof fn?.name === "string" ? [fn.name] : [];
  }).slice(0, 40);
}
