import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowUp,
  Bot,
  Loader2,
  MessageCircle,
  Mic,
  Paperclip,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  VolumeX,
  X,
} from "lucide-react";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { useAuth } from "@/lib/useAuth";
import { AssistantTurnView, FailedMessageActions } from "./AssistantBlocks";
import {
  streamAssistantSpeech,
  transcribeAssistantAudio,
  type AssistantTranscription,
  type SpokenAssistantLocale,
} from "./api";
import {
  startBrowserSpeechPreview,
  type BrowserSpeechPreview,
} from "./browserSpeech";
import { useAssistant } from "./AssistantProvider";

const MAX_RECORDING_MS = 60_000;
const NO_SPEECH_TIMEOUT_MS = 10_000;
const SILENCE_TO_SUBMIT_MS = 800;
const MIN_SPEECH_MS = 500;
const SPEECH_LEVEL_THRESHOLD = 0.025;
const LIVE_TRANSCRIPT_INTERVAL_MS = 1_800;
const MIN_LIVE_AUDIO_BYTES = 2_000;
const TTS_PCM_SAMPLE_RATE = 24_000;

function preferredAudioType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported)
    return undefined;
  return [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ].find((type) => MediaRecorder.isTypeSupported(type));
}

function useVoiceDraft(
  onTranscript: (transcription: AssistantTranscription) => void | Promise<void>,
  onLiveTranscript: (transcription: AssistantTranscription) => void,
  previewLocale: SpokenAssistantLocale,
  onError: () => void,
) {
  const [isListening, setIsListening] = useState(false);
  const [hasDetectedSpeech, setHasDetectedSpeech] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const liveTranscriptTimerRef = useRef<number | null>(null);
  const liveTranscriptAbortRef = useRef<AbortController | null>(null);
  const liveTranscriptInFlightRef = useRef(false);
  const browserPreviewRef = useRef<BrowserSpeechPreview | null>(null);
  const animationRef = useRef<number | null>(null);
  const analysisContextRef = useRef<AudioContext | null>(null);
  const isSupported =
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined" &&
    typeof AudioContext !== "undefined";

  const clearTimers = () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current);
    if (liveTranscriptTimerRef.current !== null) {
      window.clearInterval(liveTranscriptTimerRef.current);
    }
    timeoutRef.current = null;
    liveTranscriptTimerRef.current = null;
    animationRef.current = null;
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void analysisContextRef.current?.close();
    analysisContextRef.current = null;
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const requestLiveTranscript = (recorder: MediaRecorder) => {
    if (
      recorder.state !== "recording" ||
      liveTranscriptInFlightRef.current ||
      chunksRef.current.length === 0
    ) return;
    const audio = new Blob([...chunksRef.current], {
      type: recorder.mimeType || "audio/webm",
    });
    if (audio.size < MIN_LIVE_AUDIO_BYTES) return;
    const controller = new AbortController();
    liveTranscriptAbortRef.current = controller;
    liveTranscriptInFlightRef.current = true;
    void transcribeAssistantAudio(audio, controller.signal)
      .then((transcription) => {
        if (recorder.state === "recording") onLiveTranscript(transcription);
      })
      .catch(() => {
        // Preview transcription is best-effort; final transcription remains authoritative.
      })
      .finally(() => {
        if (liveTranscriptAbortRef.current === controller) {
          liveTranscriptAbortRef.current = null;
        }
        liveTranscriptInFlightRef.current = false;
      });
  };

  const startVoiceDetection = (stream: MediaStream, recorder: MediaRecorder) => {
    const context = new AudioContext();
    analysisContextRef.current = context;
    void context.resume();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(stream).connect(analyser);
    const levels = new Uint8Array(analyser.fftSize);
    const startedAt = performance.now();
    let speechStartedAt: number | null = null;
    let silenceStartedAt: number | null = null;

    const analyse = () => {
      if (recorder.state !== "recording") return;
      analyser.getByteTimeDomainData(levels);
      let energy = 0;
      for (const level of levels) {
        const sample = (level - 128) / 128;
        energy += sample * sample;
      }
      const rms = Math.sqrt(energy / levels.length);
      const now = performance.now();
      if (rms >= SPEECH_LEVEL_THRESHOLD) {
        if (speechStartedAt === null) speechStartedAt = now;
        if (now - speechStartedAt >= MIN_SPEECH_MS) setHasDetectedSpeech(true);
        silenceStartedAt = null;
      } else if (speechStartedAt !== null) {
        if (now - speechStartedAt < MIN_SPEECH_MS) {
          speechStartedAt = null;
        } else {
          if (silenceStartedAt === null) silenceStartedAt = now;
          if (now - silenceStartedAt >= SILENCE_TO_SUBMIT_MS) {
            stopRecording();
            return;
          }
        }
      }
      if (speechStartedAt === null && now - startedAt >= NO_SPEECH_TIMEOUT_MS) {
        stopRecording();
        return;
      }
      animationRef.current = window.requestAnimationFrame(analyse);
    };
    animationRef.current = window.requestAnimationFrame(analyse);
  };

  const toggle = async () => {
    if (isListening) {
      stopRecording();
      return;
    }
    if (!isSupported || isTranscribing) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      setHasDetectedSpeech(false);
      const audioType = preferredAudioType();
      const recorder = audioType
        ? new MediaRecorder(stream, { mimeType: audioType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        browserPreviewRef.current?.abort();
        browserPreviewRef.current = null;
        clearTimers();
        stopStream();
        setIsListening(false);
        setHasDetectedSpeech(false);
        onError();
      };
      recorder.onstop = () => {
        browserPreviewRef.current?.stop();
        browserPreviewRef.current = null;
        clearTimers();
        liveTranscriptAbortRef.current?.abort();
        liveTranscriptAbortRef.current = null;
        liveTranscriptInFlightRef.current = false;
        stopStream();
        setIsListening(false);
        setHasDetectedSpeech(false);
        const audio = new Blob(chunksRef.current, {
          type: recorder.mimeType || audioType || "audio/webm",
        });
        chunksRef.current = [];
        recorderRef.current = null;
        if (audio.size === 0) {
          onError();
          return;
        }
        const controller = new AbortController();
        abortRef.current = controller;
        setIsTranscribing(true);
        void transcribeAssistantAudio(audio, controller.signal)
          .then((transcription) => onTranscript(transcription))
          .catch((error: unknown) => {
            if (!(error instanceof DOMException && error.name === "AbortError"))
              onError();
          })
          .finally(() => {
            if (abortRef.current === controller) abortRef.current = null;
            setIsTranscribing(false);
          });
      };

      recorder.start(250);
      setIsListening(true);
      browserPreviewRef.current = startBrowserSpeechPreview(
        previewLocale,
        (text) => onLiveTranscript({ text, locale: previewLocale }),
      );
      if (!browserPreviewRef.current) {
        liveTranscriptTimerRef.current = window.setInterval(
          () => requestLiveTranscript(recorder),
          LIVE_TRANSCRIPT_INTERVAL_MS,
        );
      }

      startVoiceDetection(stream, recorder);
      timeoutRef.current = window.setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch {
      stopStream();
      setIsListening(false);
      onError();
    }
  };

  useEffect(
    () => () => {
      clearTimers();
      abortRef.current?.abort();
      browserPreviewRef.current?.abort();
      browserPreviewRef.current = null;
      liveTranscriptAbortRef.current?.abort();
      stopRecording();
      stopStream();
    },
    [],
  );

  return { isSupported, isListening, hasDetectedSpeech, isTranscribing, toggle };
}

function useSpokenReply(onError: () => void) {
  const [isPreparingSpeech, setIsPreparingSpeech] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const nextStartTimeRef = useRef(0);
  const streamFinishedRef = useRef(false);

  const unlockSpeech = async () => {
    if (!contextRef.current) contextRef.current = new AudioContext();
    if (contextRef.current.state === "suspended") await contextRef.current.resume();
  };

  const stopSpeaking = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    for (const source of sourcesRef.current) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // The source may already have ended.
      }
    }
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    streamFinishedRef.current = false;
    setIsPreparingSpeech(false);
    setIsSpeaking(false);
  };

  const speak = async (text: string, locale: SpokenAssistantLocale) => {
    stopSpeaking();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsPreparingSpeech(true);
    try {
      await unlockSpeech();
      const stream = await streamAssistantSpeech(text, locale, controller.signal);
      if (abortRef.current !== controller || !contextRef.current) return;

      const reader = stream.getReader();
      let remainder = new Uint8Array(0);
      let scheduledAudio = false;
      streamFinishedRef.current = false;

      while (true) {
        const { value, done } = await reader.read();
        if (abortRef.current !== controller || !contextRef.current) return;
        if (done) break;
        if (!value?.length) continue;

        const bytes = new Uint8Array(remainder.length + value.length);
        bytes.set(remainder);
        bytes.set(value, remainder.length);
        const sampleBytes = bytes.length - (bytes.length % 2);
        remainder = bytes.slice(sampleBytes);
        if (sampleBytes === 0) continue;

        const sampleCount = sampleBytes / 2;
        const samples = new Float32Array(sampleCount);
        const view = new DataView(bytes.buffer, bytes.byteOffset, sampleBytes);
        for (let index = 0; index < sampleCount; index += 1) {
          samples[index] = view.getInt16(index * 2, true) / 32_768;
        }

        const context = contextRef.current;
        const audioBuffer = context.createBuffer(
          1,
          sampleCount,
          TTS_PCM_SAMPLE_RATE,
        );
        audioBuffer.copyToChannel(samples, 0);
        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(context.destination);
        const startAt = Math.max(
          context.currentTime + 0.04,
          nextStartTimeRef.current,
        );
        nextStartTimeRef.current = startAt + audioBuffer.duration;
        sourcesRef.current.add(source);
        source.onended = () => {
          sourcesRef.current.delete(source);
          if (
            streamFinishedRef.current &&
            sourcesRef.current.size === 0 &&
            abortRef.current === controller
          ) {
            abortRef.current = null;
            setIsSpeaking(false);
          }
        };
        if (!scheduledAudio) {
          scheduledAudio = true;
          setIsPreparingSpeech(false);
          setIsSpeaking(true);
        }
        source.start(startAt);
      }

      streamFinishedRef.current = true;
      if (!scheduledAudio) {
        throw new Error("The assistant returned empty speech audio.");
      }
      if (sourcesRef.current.size === 0) {
        abortRef.current = null;
        setIsSpeaking(false);
      }
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError";
      stopSpeaking();
      if (!aborted) onError();
    }
  };

  useEffect(
    () => () => {
      stopSpeaking();
      void contextRef.current?.close();
      contextRef.current = null;
    },
    [],
  );

  return { isPreparingSpeech, isSpeaking, unlockSpeech, speak, stopSpeaking };
}

export function AssistantShell() {
  const { t, i18n } = useTranslation();
  const {
    isOpen,
    isBusy,
    statusText,
    messages,
    starterPrompts,
    open,
    close,
    toggle,
    stop,
    clearConversation,
    sendMessage,
    retryLast,
  } = useAssistant();
  const { user, membership, partner, orgName } = useAuth();
  const isMobile = useIsMobileViewport();
  const [draft, setDraft] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const voicePreviewLocale: SpokenAssistantLocale =
    i18n.resolvedLanguage?.startsWith("ta")
      ? "ta-IN"
      : i18n.resolvedLanguage?.startsWith("hi")
        ? "hi-IN"
        : "en-IN";
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const {
    isPreparingSpeech,
    isSpeaking,
    unlockSpeech,
    speak,
    stopSpeaking,
  } = useSpokenReply(() => setVoiceError(t("assistant.errors.voiceFailed")));
  const {
    isSupported: voiceSupported,
    isListening,
    hasDetectedSpeech,
    isTranscribing,
    toggle: toggleVoice,
  } = useVoiceDraft(
    async ({ text, locale }) => {
      setDraft("");
      setVoiceError("");
      await sendMessage(text, {
        locale,
        onAnswerStart: (answer) => {
          void speak(answer, locale);
        },
      });
    },
    ({ text }) => setDraft(text),
    voicePreviewLocale,
    () => setVoiceError(t("assistant.errors.voiceFailed")),
  );

  const visible = Boolean(user && (membership || partner));
  const hasMessages = messages.length > 0;
  const latestFailed =
    [...messages].reverse().find((message) => message.role === "assistant")
      ?.status === "failed";

  const welcome = useMemo(() => {
    const dealership = orgName ?? t("assistant.welcome.defaultDealership");
    return t("assistant.welcome.description", { dealership });
  }, [orgName, t]);

  useEffect(() => {
    if (!visible) return;
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggle();
      }
      if (event.key === "Escape" && isOpen) close();
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [close, isOpen, toggle, visible]);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      window.setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [isBusy, isOpen, messages, statusText]);

  useEffect(() => {
    if (!isOpen || !isMobile) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = oldOverflow;
    };
  }, [isMobile, isOpen]);

  if (!visible) return null;

  const submit = () => {
    const message = draft.trim();
    if (!message || isBusy) return;
    setDraft("");
    void sendMessage(message);
  };

  const onComposerKeyDown = (
    event: ReactKeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const onPanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !isMobile || !panelRef.current) return;
    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={open}
          className={`fixed z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-blue-600 text-white shadow-xl shadow-brand-900/20 transition hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
            isMobile
              ? "bottom-[5.5rem] right-4 h-12 w-12 justify-center"
              : "bottom-6 right-6 px-4 py-3"
          }`}
          aria-label={t("assistant.launcher.openAria")}
          title={t("assistant.launcher.tooltip")}
        >
          <Sparkles size={19} />
          {!isMobile && (
            <span className="text-sm font-semibold">
              {t("assistant.launcher.label")}
            </span>
          )}
        </button>
      )}

      {isOpen && !isMobile && (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default bg-slate-950/10 backdrop-blur-[1px] lg:bg-transparent lg:backdrop-blur-none"
          onClick={close}
          aria-label={t("assistant.header.close")}
        />
      )}

      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal={isMobile || undefined}
          aria-label={t("assistant.header.dialogAria")}
          onKeyDown={onPanelKeyDown}
          className={`fixed z-50 flex flex-col overflow-hidden bg-slate-50 shadow-2xl ${
            isMobile
              ? "inset-0"
              : "bottom-3 right-3 top-3 w-[min(470px,calc(100vw-24px))] rounded-2xl border border-slate-200"
          }`}
        >
          <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-blue-600 text-white shadow-sm">
              <Sparkles size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold text-slate-950">
                {t("assistant.header.title")}
              </h2>
              <p className="truncate text-[11px] text-slate-500">
                {isBusy
                  ? statusText || t("assistant.status.working")
                  : t("assistant.header.subtitle")}
              </p>
            </div>
            {hasMessages && (
              <button
                type="button"
                onClick={clearConversation}
                disabled={isBusy}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                aria-label={t("assistant.header.newConversation")}
                title={t("assistant.header.newConversation")}
              >
                <Trash2 size={17} />
              </button>
            )}
            <button
              type="button"
              onClick={close}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label={t("assistant.header.close")}
            >
              <X size={19} />
            </button>
          </header>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3.5 py-4 sm:px-4"
          >
            {!hasMessages ? (
              <div className="flex min-h-full flex-col justify-center py-6">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                  <Bot size={26} />
                </div>
                <h3 className="mt-4 text-center text-lg font-semibold text-slate-950">
                  {t("assistant.welcome.title")}
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-slate-500">
                  {welcome}
                </p>
                <div className="mx-auto mt-6 grid w-full max-w-sm gap-2">
                  {starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendMessage(prompt)}
                      className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left text-sm text-slate-700 shadow-sm transition hover:border-brand-200 hover:bg-brand-50/50 hover:text-brand-900"
                    >
                      <span>{prompt}</span>
                      <MessageCircle
                        size={15}
                        className="shrink-0 text-slate-300 transition group-hover:text-brand-500"
                      />
                    </button>
                  ))}
                </div>
                <p className="mt-5 text-center text-[10px] text-slate-400">
                  {t("assistant.safety.disclaimer")}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={
                      message.role === "user"
                        ? "flex justify-end"
                        : "flex items-start gap-2.5"
                    }
                  >
                    {message.role === "assistant" && (
                      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
                        <Sparkles size={14} />
                      </span>
                    )}
                    <div
                      className={
                        message.role === "user"
                          ? "max-w-[85%]"
                          : "min-w-0 max-w-[calc(100%-38px)] flex-1"
                      }
                    >
                      {message.role === "user" ? (
                        <div className="rounded-2xl rounded-br-md bg-slate-900 px-3.5 py-2.5 text-sm leading-relaxed text-white">
                          {message.text}
                        </div>
                      ) : message.turn ? (
                        <AssistantTurnView turn={message.turn} />
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-700">
                          {message.text || (
                            <span className="flex items-center gap-2 text-slate-400">
                              <Loader2 size={14} className="animate-spin" />
                              {statusText || t("assistant.status.thinking")}
                            </span>
                          )}
                        </div>
                      )}
                      {message.status === "failed" && <FailedMessageActions />}
                    </div>
                  </article>
                ))}

                {isBusy && statusText && (
                  <div
                    className="flex items-center gap-2 pl-9 text-[11px] text-slate-400"
                    aria-live="polite"
                  >
                    <Loader2 size={12} className="animate-spin" />
                    {statusText}
                  </div>
                )}

                {latestFailed && !isBusy && (
                  <button
                    type="button"
                    onClick={() => void retryLast()}
                    className="ml-9 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <RotateCcw size={12} />
                    {t("assistant.buttons.retry")}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            {(isListening || isTranscribing || isPreparingSpeech || isSpeaking) && (
              <div
                role="status"
                aria-live="polite"
                className="mb-2 flex min-h-12 items-center gap-3 border-l-2 border-brand-500 bg-brand-50 px-3 py-2 text-brand-950"
              >
                <span className="relative flex h-3 w-3 shrink-0">
                  {isListening && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />}
                  <span className={`relative inline-flex h-3 w-3 rounded-full ${isListening ? "bg-red-500" : "bg-brand-600"}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">
                    {t(
                      isListening
                        ? "assistant.voice.listening"
                        : isSpeaking
                          ? "assistant.voice.speaking"
                          : isPreparingSpeech
                            ? "assistant.status.finalizing"
                            : "assistant.status.understanding",
                    )}
                  </p>
                  {isListening && (
                    <p className="mt-0.5 text-[10px] text-brand-700">
                      {t(hasDetectedSpeech ? "assistant.voice.listening" : "assistant.composer.placeholder")}
                    </p>
                  )}
                </div>
                {(isListening || isSpeaking) && (
                  <div className="flex h-6 items-center gap-0.5" aria-hidden="true">
                    {[10, 18, 13, 21, 15].map((height, index) => (
                      <span
                        key={height}
                        className="w-0.5 animate-pulse rounded-full bg-brand-600"
                        style={{ height, animationDelay: `${index * 90}ms` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="rounded-xl border border-slate-300 bg-white shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/15">
              <textarea
                ref={inputRef}
                rows={2}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onComposerKeyDown}
                disabled={isBusy}
                placeholder={t("assistant.composer.placeholder")}
                aria-label={t("assistant.composer.messageAria")}
                className="block max-h-32 min-h-[52px] w-full resize-none rounded-t-xl border-0 bg-transparent px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:bg-slate-50"
              />
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled
                    className="rounded-lg p-2 text-slate-300"
                    aria-label={t("assistant.composer.attach")}
                    title={t("assistant.composer.attachmentsUnavailable")}
                  >
                    <Paperclip size={17} />
                  </button>
                  {voiceSupported && (
                    <button
                      type="button"
                      onClick={() => {
                        setVoiceError("");
                        if (!isListening) {
                          stopSpeaking();
                          void unlockSpeech();
                        }
                        void toggleVoice();
                      }}
                      disabled={isBusy || isTranscribing}
                      className={`rounded-lg p-2 transition ${
                        isListening
                          ? "bg-red-50 text-red-600"
                          : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      }`}
                      aria-label={t(
                        isTranscribing
                          ? "assistant.status.working"
                          : isListening
                            ? "assistant.voice.stop"
                            : "assistant.voice.start",
                      )}
                      title={t(
                        isTranscribing
                          ? "assistant.status.working"
                          : isListening
                            ? "assistant.voice.stop"
                            : "assistant.voice.start",
                      )}
                    >
                      {isTranscribing ? (
                        <Loader2 size={17} className="animate-spin" />
                      ) : isListening ? (
                        <Square size={14} fill="currentColor" />
                      ) : (
                        <Mic size={17} />
                      )}
                    </button>
                  )}
                  {(isPreparingSpeech || isSpeaking) && (
                    <button
                      type="button"
                      onClick={stopSpeaking}
                      className="rounded-lg p-2 text-brand-600 transition hover:bg-brand-50 hover:text-brand-800"
                      aria-label={t("assistant.composer.stop")}
                      title={t("assistant.composer.stop")}
                    >
                      {isPreparingSpeech
                        ? <Loader2 size={17} className="animate-spin" />
                        : <VolumeX size={17} />}
                    </button>
                  )}
                </div>
                {isBusy ? (
                  <button
                    type="button"
                    onClick={stop}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                    aria-label={t("assistant.composer.stop")}
                  >
                    <Square size={13} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!draft.trim()}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                    aria-label={t("assistant.composer.send")}
                  >
                    <ArrowUp size={18} />
                  </button>
                )}
              </div>
            </div>
            {voiceError && (
              <p
                role="alert"
                className="mt-1.5 text-center text-[10px] text-red-600"
              >
                {voiceError}
              </p>
            )}
            <p className="mt-1.5 text-center text-[9px] text-slate-400">
              {t(voiceSupported ? "assistant.composer.placeholder" : "assistant.composer.keyboardHint")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
