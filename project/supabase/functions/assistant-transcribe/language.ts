export type SpokenLocale = "en-IN" | "ta-IN" | "hi-IN";

export function detectSpokenLocale(text: string): SpokenLocale {
  const tamil = text.match(/[\u0B80-\u0BFF]/gu)?.length ?? 0;
  const hindi = text.match(/[\u0900-\u097F]/gu)?.length ?? 0;
  if (tamil > hindi && tamil > 0) return "ta-IN";
  if (hindi > 0) return "hi-IN";
  return "en-IN";
}
