interface TraceItem {
  index: number;
  type: string;
  role?: string;
  content_type?: string;
  content_characters?: number;
  tool_name?: string;
  argument_keys?: string[];
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;
}

function argumentKeys(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = record(JSON.parse(value));
    return parsed ? Object.keys(parsed).sort().slice(0, 40) : [];
  } catch {
    return [];
  }
}

export function summarizeModelItems(items: readonly unknown[]): TraceItem[] {
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
    if (typeof item.name === "string") summary.tool_name = item.name;
    if (typeof content === "string") {
      summary.content_type = "text";
      summary.content_characters = content.length;
    } else if (Array.isArray(content)) {
      summary.content_type = "parts";
      summary.content_characters = content.reduce((total, part) => {
        const partRecord = record(part);
        return total +
          (typeof partRecord?.text === "string" ? partRecord.text.length : 0);
      }, 0);
    }
    const keys = argumentKeys(item.arguments);
    if (keys.length > 0) summary.argument_keys = keys;
    return summary;
  });
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
