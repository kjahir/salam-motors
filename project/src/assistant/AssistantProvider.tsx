import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { getAppLocale } from "@/i18n";
import { useAuth } from "@/lib/useAuth";
import {
  requestAssistantTurn,
  type AssistantStatusParams,
  type AssistantTurnMeta,
  type SpokenAssistantLocale,
} from "./api";
import { assistantErrorTranslationKey } from "./errors";
import {
  createFallbackTurn,
  type AssistantAction,
  type AssistantChatMessage,
  type AssistantRequestContext,
  type AssistantVoiceContext,
} from "./schema";

type NavigationHandler = (page: string, params?: Extract<AssistantAction, { kind: "navigate" }>["params"]) => boolean;

export interface AssistantSendOptions {
  locale?: SpokenAssistantLocale;
  /** Present when the message came from speech. Forwarded to the backend purely so the
   *  run's execution trace can record step 2 ("optionally transcribe speech") — the
   *  transcribe function runs before the run exists and cannot trace itself. */
  voice?: AssistantVoiceContext;
  /** `meta` identifies the run, so a spoken reply can be traced against it. */
  onAnswerStart?: (text: string, meta: AssistantTurnMeta) => void;
}

interface AssistantContextValue {
  isOpen: boolean;
  isBusy: boolean;
  statusText: string;
  /**
   * The i18n key behind `statusText`, empty when the server sent literal copy. The shell
   * uses it to pick an icon: the text is already translated, so matching on it would mean
   * matching translated prose.
   */
  statusKey: string;
  streamingText: string;
  conversationId?: string;
  messages: AssistantChatMessage[];
  appContext: AssistantRequestContext;
  starterPrompts: string[];
  open: () => void;
  close: () => void;
  toggle: () => void;
  stop: () => void;
  clearConversation: () => void;
  sendMessage: (message: string, options?: AssistantSendOptions) => Promise<string | undefined>;
  retryLast: () => Promise<void>;
  handleAction: (action: AssistantAction) => Promise<void>;
  setAppContext: (context: AssistantRequestContext) => void;
  registerNavigation: (handler: NavigationHandler | null) => void;
}

const AssistantContext = createContext<AssistantContextValue | undefined>(undefined);

type StarterKey = "owner" | "manager" | "sales_executive" | "accountant" | "mechanic_inspector" | "partner" | "default";

function starterKeyFor(role: string | null, isPartner: boolean): StarterKey {
  if (isPartner) return "partner";
  switch (role) {
    case "owner":
    case "manager":
    case "sales_executive":
    case "accountant":
    case "mechanic_inspector":
      return role;
    default:
      return "default";
  }
}

/** How long a status stays on screen before a newer one may replace it. */
const MIN_STATUS_MS = 600;
/** How far the status line may fall behind the work before it starts skipping steps. */
const MAX_QUEUED_STATUSES = 3;

function nowId(prefix: string): string {
  return `${prefix}-${Date.now()}-${crypto.randomUUID()}`;
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const activeLocale = getAppLocale(i18n.resolvedLanguage);
  const { user, role, membership, partner, orgId } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [statusKey, setStatusKey] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [appContext, setAppContextState] = useState<AssistantRequestContext>({
    surface: "desktop",
    page: "dashboard",
  });
  const abortRef = useRef<AbortController | null>(null);
  const navigationRef = useRef<NavigationHandler | null>(null);
  const lastUserMessageRef = useRef<string>("");
  const lastSendOptionsRef = useRef<AssistantSendOptions | undefined>();
  const principalRef = useRef<string | null>(null);
  const statusShownAtRef = useRef(0);
  const statusTimerRef = useRef<number | null>(null);
  const pendingStatusRef = useRef<(() => void)[]>([]);

  const starterPrompts = useMemo(
    () => {
      const value = t(`assistant.starters.${starterKeyFor(role, Boolean(partner && !role))}.prompts`, { returnObjects: true });
      return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    },
    [partner, role, t],
  );

  /**
   * Shows a status the server sent.
   *
   * The server names what it is doing with a key and its values — "looking for X", "found
   * N" — and never a finished sentence, so the wording is chosen here, in the caller's
   * language. Anything that is not a key is shown verbatim; older backends sent prose.
   *
   * Statuses are held for {@link MIN_STATUS_MS} before being replaced. The server emits
   * them at the speed it works, and some pairs land microseconds apart — a search result
   * count is followed immediately by the next model round — so without a floor the more
   * informative half of the pair would never be on screen long enough to read.
   */
  const showStatus = useCallback(
    (text: string, params?: AssistantStatusParams) => {
      const isKey = text.startsWith("assistant.");
      const apply = () => {
        statusShownAtRef.current = Date.now();
        setStatusKey(isKey ? text : "");
        setStatusText(isKey ? t(text, params ?? {}) : text);
      };
      const waited = Date.now() - statusShownAtRef.current;
      if (waited >= MIN_STATUS_MS && statusTimerRef.current === null) {
        apply();
        return;
      }
      // Queued rather than replaced: a status that lost the race — "found 4 matches",
      // overtaken by the next round a millisecond later — is usually the interesting one.
      // The queue is short, so the line trails the real work by at most a beat or two, and
      // the burst it absorbs is over long before the model round it describes is.
      pendingStatusRef.current.push(apply);
      if (pendingStatusRef.current.length > MAX_QUEUED_STATUSES) {
        pendingStatusRef.current.shift();
      }
      if (statusTimerRef.current !== null) return;
      const release = () => {
        const next = pendingStatusRef.current.shift();
        if (!next) {
          statusTimerRef.current = null;
          return;
        }
        next();
        statusTimerRef.current = pendingStatusRef.current.length > 0
          ? window.setTimeout(release, MIN_STATUS_MS)
          : null;
      };
      statusTimerRef.current = window.setTimeout(
        release,
        Math.max(0, MIN_STATUS_MS - waited),
      );
    },
    [t],
  );

  const clearStatus = useCallback(() => {
    if (statusTimerRef.current !== null) {
      window.clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }
    pendingStatusRef.current = [];
    statusShownAtRef.current = 0;
    setStatusKey("");
    setStatusText("");
  }, []);

  useEffect(() => () => {
    if (statusTimerRef.current !== null) window.clearTimeout(statusTimerRef.current);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsBusy(false);
    clearStatus();
    setStreamingText("");
  }, [clearStatus]);

  const clearConversation = useCallback(() => {
    stop();
    setConversationId(undefined);
    setMessages([]);
    setStreamingText("");
    lastUserMessageRef.current = "";
    lastSendOptionsRef.current = undefined;
  }, [stop]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((current) => !current), []);

  const setAppContext = useCallback((context: AssistantRequestContext) => {
    setAppContextState((current) =>
      current.surface === context.surface &&
        current.page === context.page &&
        current.vehicleId === context.vehicleId &&
        current.vehicleTab === context.vehicleTab
        ? current
        : context,
    );
  }, []);

  const registerNavigation = useCallback((handler: NavigationHandler | null) => {
    navigationRef.current = handler;
  }, []);

  useEffect(() => {
    const principalKind = membership ? "staff" : partner ? "partner" : "unlinked";
    const principalKey = user?.id && orgId
      ? [
          activeLocale,
          user.id,
          orgId,
          principalKind,
          membership?.id ?? "no-membership",
          membership?.status ?? "no-membership-status",
          role ?? "no-role",
          partner?.id ?? "no-partner",
          partner?.status ?? "no-partner-status",
        ].join(":")
      : null;
    if (principalRef.current !== principalKey) {
      clearConversation();
    }
    principalRef.current = principalKey;
  }, [activeLocale, clearConversation, membership, orgId, partner, role, user?.id]);

  const sendMessage = useCallback(
    async (rawMessage: string, options?: AssistantSendOptions) => {
      const message = rawMessage.trim();
      if (!message || isBusy || abortRef.current) return;

      const requestLocale = options?.locale ?? activeLocale;
      lastUserMessageRef.current = message;
      lastSendOptionsRef.current = options?.locale
        ? { locale: options.locale }
        : undefined;
      const userMessage: AssistantChatMessage = {
        id: nowId("user"),
        role: "user",
        text: message,
        createdAt: new Date().toISOString(),
        status: "complete",
      };
      const assistantMessageId = nowId("assistant");
      const assistantMessage: AssistantChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        text: "",
        createdAt: new Date().toISOString(),
        status: "streaming",
      };

      setMessages((current) => [...current, userMessage, assistantMessage]);
      setIsBusy(true);
      showStatus("assistant.status.understanding");
      setStreamingText("");

      const controller = new AbortController();
      abortRef.current = controller;
      let streamed = "";
      let answerStarted = false;
      // Filled by the SSE `meta` event, which the server sends before the first delta.
      let turnMeta: AssistantTurnMeta = { runId: null };
      /*
      Fires once, with the complete answer.

      It used to fire on the first delta, which meant speech synthesis was handed only
      whatever had arrived by then — the first ~96-character presentation chunk — and the
      `answerStarted` guard stopped the finished text from ever reaching it. Real token
      streaming turned that into the first few characters, which is what surfaced it.

      Waiting for the turn also fixes the language-correction case: when the model answers
      in the wrong language the server rewrites answer.text afterwards, and speaking the
      pre-correction text would read the wrong language aloud.
      */
      const notifyAnswerStart = (text: string) => {
        if (answerStarted || !text.trim()) return;
        answerStarted = true;
        options?.onAnswerStart?.(text, turnMeta);
      };

      try {
        const response = await requestAssistantTurn(
          {
            conversationId,
            message,
            locale: requestLocale,
            context: options?.voice ? { ...appContext, voice: options.voice } : appContext,
            stream: true,
          },
          {
            onStatus: (text, params) => {
              if (abortRef.current === controller) showStatus(text, params);
            },
            onMeta: (meta) => {
              if (abortRef.current === controller) turnMeta = meta;
            },
            onDelta: (text) => {
              if (abortRef.current !== controller) return;
              streamed += text;
              setStreamingText(streamed);
              setMessages((current) =>
                current.map((item) =>
                  item.id === assistantMessageId ? { ...item, text: streamed, status: "streaming" } : item,
                ),
              );
            },
          },
          controller.signal,
        );

        if (abortRef.current !== controller) return;
        notifyAnswerStart(response.turn.answer.text);
        setConversationId(response.conversationId ?? response.turn.conversationId);
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessageId
              ? {
                  ...item,
                  text: response.turn.answer.text,
                  turn: response.turn,
                  status: "complete",
                }
              : item,
          ),
        );
        return response.turn.answer.text;
      } catch (error) {
        const aborted = error instanceof DOMException && error.name === "AbortError";
        const text = aborted
          ? t("assistant.status.stopped")
          : t(assistantErrorTranslationKey(error));
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessageId
              ? {
                  ...item,
                  text,
                  turn: createFallbackTurn(text, requestLocale, aborted ? "neutral" : "danger"),
                  status: aborted ? "complete" : "failed",
                  error: aborted ? undefined : text,
                }
              : item,
          ),
        );
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setIsBusy(false);
          clearStatus();
          setStreamingText("");
        }
      }
    },
    [activeLocale, appContext, clearStatus, conversationId, isBusy, showStatus, t],
  );

  const executeAction = useCallback(
    async (token: string) => {
      if (isBusy || abortRef.current) return;
      const assistantMessageId = nowId("assistant-action");
      setMessages((current) => [
        ...current,
        {
          id: assistantMessageId,
          role: "assistant",
          text: "",
          createdAt: new Date().toISOString(),
          status: "streaming",
        },
      ]);
      setIsBusy(true);
      showStatus("assistant.status.revalidating");

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await requestAssistantTurn(
          {
            conversationId,
            message: "Execute the confirmed action.",
            locale: activeLocale,
            context: appContext,
            stream: true,
            action: { token },
          },
          {
            onStatus: (text, params) => {
              if (abortRef.current === controller) showStatus(text, params);
            },
          },
          controller.signal,
        );
        if (abortRef.current !== controller) return;
        setConversationId(response.conversationId ?? response.turn.conversationId);
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessageId
              ? { ...item, text: response.turn.answer.text, turn: response.turn, status: "complete" }
              : item,
          ),
        );
      } catch (error) {
        const aborted = error instanceof DOMException && error.name === "AbortError";
        const text = aborted
          ? t("assistant.status.stopped")
          : t(assistantErrorTranslationKey(error, true));
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessageId
              ? {
                  ...item,
                  text,
                  turn: createFallbackTurn(text, activeLocale, aborted ? "neutral" : "danger"),
                  status: aborted ? "complete" : "failed",
                  error: aborted ? undefined : text,
                }
              : item,
          ),
        );
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setIsBusy(false);
          clearStatus();
        }
      }
    },
    [activeLocale, appContext, clearStatus, conversationId, isBusy, showStatus, t],
  );

  const handleAction = useCallback(
    async (action: AssistantAction) => {
      if (action.kind === "reply") {
        await sendMessage(action.message);
        return;
      }
      if (action.kind === "navigate") {
        const navigated = navigationRef.current?.(action.page, action.params) ?? false;
        if (navigated) setIsOpen(false);
        return;
      }
      if (action.kind === "invoke") {
        await executeAction(action.actionToken);
        return;
      }
      if (action.kind === "download") {
        // Artifact transport is unavailable. Keep this fail-closed even for
        // programmatic callers that bypass the disabled renderer control.
        return;
      }
    },
    [executeAction, sendMessage],
  );

  const retryLast = useCallback(async () => {
    if (lastUserMessageRef.current) {
      await sendMessage(lastUserMessageRef.current, lastSendOptionsRef.current);
    }
  }, [sendMessage]);

  const value = useMemo<AssistantContextValue>(
    () => ({
      isOpen,
      isBusy,
      statusText,
      statusKey,
      streamingText,
      conversationId,
      messages,
      appContext,
      starterPrompts,
      open,
      close,
      toggle,
      stop,
      clearConversation,
      sendMessage,
      retryLast,
      handleAction,
      setAppContext,
      registerNavigation,
    }),
    [
      appContext,
      clearConversation,
      close,
      conversationId,
      handleAction,
      isBusy,
      isOpen,
      messages,
      open,
      registerNavigation,
      retryLast,
      sendMessage,
      setAppContext,
      starterPrompts,
      statusKey,
      statusText,
      stop,
      streamingText,
      toggle,
    ],
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) throw new Error("useAssistant must be used within AssistantProvider");
  return context;
}
