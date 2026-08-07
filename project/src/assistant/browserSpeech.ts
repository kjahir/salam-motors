export interface BrowserSpeechPreview {
  stop: () => void;
  abort: () => void;
}

interface SpeechAlternativeLike {
  transcript: string;
}

interface SpeechResultLike {
  isFinal: boolean;
  0: SpeechAlternativeLike;
}

interface SpeechResultEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechResultEventLike) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export function startBrowserSpeechPreview(
  locale: "en-IN" | "ta-IN" | "hi-IN",
  onText: (text: string) => void,
): BrowserSpeechPreview | null {
  if (typeof window === "undefined") return null;
  const scope = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  const Constructor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  if (!Constructor) return null;

  const recognition = new Constructor();
  let active = true;
  let finalText = "";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = locale;
  recognition.onresult = (event) => {
    if (!active) return;
    let interimText = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = result?.[0]?.transcript?.trim() ?? "";
      if (!transcript) continue;
      if (result.isFinal) {
        finalText = `${finalText} ${transcript}`.trim();
      } else {
        interimText = `${interimText} ${transcript}`.trim();
      }
    }
    const visibleText = `${finalText} ${interimText}`.trim();
    if (visibleText) onText(visibleText);
  };
  recognition.onerror = () => {
    // The authenticated server transcription remains the final fallback.
  };
  try {
    recognition.start();
  } catch {
    return null;
  }
  return {
    stop: () => {
      active = false;
      try {
        recognition.stop();
      } catch {
        // Recognition may already have ended.
      }
    },
    abort: () => {
      active = false;
      try {
        recognition.abort();
      } catch {
        // Recognition may already have ended.
      }
    },
  };
}
