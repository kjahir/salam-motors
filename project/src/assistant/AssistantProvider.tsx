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
import { requestAssistantTurn } from "./api";
import { assistantErrorTranslationKey } from "./errors";
import {
  createFallbackTurn,
  type AssistantAction,
  type AssistantChatMessage,
  type AssistantRequestContext,
} from "./schema";

type NavigationHandler = (page: string, params?: Extract<AssistantAction, { kind: "navigate" }>["params"]) => boolean;

interface AssistantContextValue {
  isOpen: boolean;
  isBusy: boolean;
  statusText: string;
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
  sendMessage: (message: string) => Promise<void>;
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
  const principalRef = useRef<string | null>(null);

  const starterPrompts = useMemo(
    () => {
      const value = t(`assistant.starters.${starterKeyFor(role, Boolean(partner && !role))}.prompts`, { returnObjects: true });
      return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    },
    [partner, role, t],
  );

  const localizeStatus = useCallback(
    (text: string) => text.startsWith("assistant.") ? t(text) : text,
    [t],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsBusy(false);
    setStatusText("");
    setStreamingText("");
  }, []);

  const clearConversation = useCallback(() => {
    stop();
    setConversationId(undefined);
    setMessages([]);
    setStreamingText("");
    lastUserMessageRef.current = "";
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
    async (rawMessage: string) => {
      const message = rawMessage.trim();
      if (!message || isBusy || abortRef.current) return;

      lastUserMessageRef.current = message;
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
      setStatusText(t("assistant.status.understanding"));
      setStreamingText("");

      const controller = new AbortController();
      abortRef.current = controller;
      let streamed = "";

      try {
        const response = await requestAssistantTurn(
          {
            conversationId,
            message,
            locale: activeLocale,
            context: appContext,
            stream: true,
          },
          {
            onStatus: (text) => {
              if (abortRef.current === controller) setStatusText(localizeStatus(text));
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
          setStatusText("");
          setStreamingText("");
        }
      }
    },
    [activeLocale, appContext, conversationId, isBusy, localizeStatus, t],
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
      setStatusText(t("assistant.status.revalidating"));

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
            onStatus: (text) => {
              if (abortRef.current === controller) setStatusText(localizeStatus(text));
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
          setStatusText("");
        }
      }
    },
    [activeLocale, appContext, conversationId, isBusy, localizeStatus, t],
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
    if (lastUserMessageRef.current) await sendMessage(lastUserMessageRef.current);
  }, [sendMessage]);

  const value = useMemo<AssistantContextValue>(
    () => ({
      isOpen,
      isBusy,
      statusText,
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
