import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send, X } from "lucide-react";
import { useNotificationContext } from "./NotificationProvider";
import supportIcon from "../assets/crypto/customersupport.svg";

type Sender = "bot" | "user" | "system";

interface ChatMessage {
  id: string;
  sender: Sender;
  text: string;
  createdAt: number;
}

type SupportTopic =
  | "deposits"
  | "transaction_hash"
  | "withdrawal"
  | "levels"
  | "referrals"
  | "unknown";

interface TopicResponse {
  title: string;
  body: string;
}

const WELCOME_MESSAGE =
  "Hello 👋\nI’m your assistant. I can help with deposits, withdrawals, and account-related questions.";
const TELEGRAM_URL =
  import.meta.env.VITE_SUPPORT_TELEGRAM_URL || "https://t.me/nexacrypto_support";
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_MESSAGES = 8;
const MESSAGE_COOLDOWN_MS = 1_200;

const TOPIC_RESPONSES: Record<Exclude<SupportTopic, "unknown">, TopicResponse> = {
  deposits: {
    title: "Deposits",
    body: "Go to Deposit, choose a network and copy the generated wallet address. Deposits are credited after network confirmations and admin review."
  },
  transaction_hash: {
    title: "Transaction Hash",
    body: "A valid hash must match the selected network. Submit it in Deposit History and keep the amount and network exactly the same as your transfer."
  },
  withdrawal: {
    title: "Withdrawals",
    body: "Withdrawals unlock based on your current level threshold. Requests are security-screened and then approved by admins before payout."
  },
  levels: {
    title: "Levels & Multipliers",
    body: "Levels increase from cumulative qualified deposits. Higher levels improve multiplier rewards and may raise available withdrawal limits."
  },
  referrals: {
    title: "Referrals",
    body: "Invite users from your referral page. Rewards apply only to valid activity and are filtered against duplicate wallets and abuse patterns."
  }
};

function normalizeMessage(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function detectTopic(input: string): SupportTopic {
  const normalized = normalizeMessage(input);
  if (!normalized) return "unknown";

  if (
    normalized.includes("deposit") ||
    normalized.includes("top up") ||
    normalized.includes("fund")
  ) {
    return "deposits";
  }

  if (
    normalized.includes("hash") ||
    normalized.includes("txid") ||
    normalized.includes("tx id") ||
    normalized.includes("transaction id") ||
    normalized.includes("transaction hash")
  ) {
    return "transaction_hash";
  }

  if (
    normalized.includes("withdraw") ||
    normalized.includes("payout") ||
    normalized.includes("cash out")
  ) {
    return "withdrawal";
  }

  if (
    normalized.includes("level") ||
    normalized.includes("multiplier") ||
    normalized.includes("xp") ||
    normalized.includes("reward")
  ) {
    return "levels";
  }

  if (
    normalized.includes("referral") ||
    normalized.includes("invite") ||
    normalized.includes("affiliate")
  ) {
    return "referrals";
  }

  return "unknown";
}

function botMessageForTopic(topic: SupportTopic): string {
  if (topic === "unknown") {
    return "I could not confidently match that request. Ask about deposits, transaction hash, withdrawals, levels, or referrals for an instant answer.";
  }
  const entry = TOPIC_RESPONSES[topic];
  return `${entry.title}\n${entry.body}`;
}

function typingDelayMs(text: string): number {
  return Math.min(1500, 450 + text.length * 8);
}

function buildId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function SupportChatWidget({ enabled }: { enabled: boolean }) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const responseTimerRef = useRef<number | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: buildId("welcome"),
      sender: "bot",
      text: WELCOME_MESSAGE,
      createdAt: Date.now()
    }
  ]);
  const [interactionCount, setInteractionCount] = useState(0);
  const [lastUserMessageAt, setLastUserMessageAt] = useState(0);
  const [messageTimestamps, setMessageTimestamps] = useState<number[]>([]);
  const [lastNormalizedInput, setLastNormalizedInput] = useState("");
  const [repeatCount, setRepeatCount] = useState(0);
  const [showEscalation, setShowEscalation] = useState(false);
  const { panelNotifications } = useNotificationContext();

  const recentNotificationKeysRef = useRef<Set<string>>(new Set());

  const canRender = enabled;

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => a.createdAt - b.createdAt),
    [messages]
  );

  useEffect(() => {
    if (!canRender) {
      setIsOpen(false);
    }
  }, [canRender]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (wrapperRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const node = listRef.current;
    if (!node) {
      return;
    }
    node.scrollTo({
      top: node.scrollHeight,
      behavior: "smooth"
    });
  }, [sortedMessages, isTyping, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const timeout = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    if (!panelNotifications.length) {
      return;
    }

    const latest = panelNotifications.slice(0, 6);
    const incoming: ChatMessage[] = [];

    for (const item of latest) {
      if (
        item.type !== "deposit_status" &&
        item.type !== "withdrawal_status" &&
        item.type !== "deposit_created" &&
        item.type !== "withdrawal_created"
      ) {
        continue;
      }
      if (recentNotificationKeysRef.current.has(item.notification_id)) {
        continue;
      }
      recentNotificationKeysRef.current.add(item.notification_id);
      incoming.push({
        id: buildId("system"),
        sender: "system",
        text: item.message,
        createdAt: Date.now()
      });
    }

    if (incoming.length > 0) {
      setMessages((prev) => [...prev, ...incoming]);
    }
  }, [panelNotifications]);

  useEffect(() => {
    return () => {
      if (responseTimerRef.current !== null) {
        window.clearTimeout(responseTimerRef.current);
      }
    };
  }, []);

  const pushBotReply = (text: string) => {
    const delay = typingDelayMs(text);
    setIsTyping(true);
    responseTimerRef.current = window.setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: buildId("bot"),
          sender: "bot",
          text,
          createdAt: Date.now()
        }
      ]);
    }, delay);
  };

  const pushSystemRateLimit = () => {
    setMessages((prev) => [
      ...prev,
      {
        id: buildId("system"),
        sender: "system",
        text: "Please wait a moment before sending another message.",
        createdAt: Date.now()
      }
    ]);
  };

  const handleSend = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }

    const now = Date.now();
    if (now - lastUserMessageAt < MESSAGE_COOLDOWN_MS || isTyping) {
      pushSystemRateLimit();
      return;
    }

    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    const nextTimestamps = messageTimestamps.filter((value) => value >= windowStart);
    if (nextTimestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
      pushSystemRateLimit();
      return;
    }

    const normalized = normalizeMessage(trimmed);
    const sameAsPrevious = normalized.length > 0 && normalized === lastNormalizedInput;
    const nextRepeatCount = sameAsPrevious ? repeatCount + 1 : 1;
    if (sameAsPrevious && nextRepeatCount >= 3) {
      pushSystemRateLimit();
      setShowEscalation(true);
      return;
    }

    const userMessage: ChatMessage = {
      id: buildId("user"),
      sender: "user",
      text: trimmed,
      createdAt: now
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLastUserMessageAt(now);
    setMessageTimestamps([...nextTimestamps, now]);
    setLastNormalizedInput(normalized);
    setRepeatCount(nextRepeatCount);

    const topic = detectTopic(trimmed);
    const reply = botMessageForTopic(topic);
    const nextInteractionCount = interactionCount + 1;
    setInteractionCount(nextInteractionCount);

    const shouldEscalate = topic === "unknown" || nextInteractionCount >= 2;
    if (shouldEscalate) {
      setShowEscalation(true);
    }

    pushBotReply(reply);
  };

  const openChat = () => {
    setIsOpen(true);
  };

  if (!canRender) {
    return null;
  }

  return (
    <div ref={wrapperRef} className="fixed bottom-24 right-4 z-50 sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="mb-3 flex h-[480px] w-[min(92vw,370px)] flex-col overflow-hidden rounded-2xl border border-[#26272B] bg-[#121315] shadow-[0_24px_60px_rgba(0,0,0,0.75)]"
          >
            <div className="flex items-center justify-between border-b border-[#26272B] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#F5F5F7]">Support Assistant</p>
                <p className="text-[11px] text-[#9CA3AF]">Fast help and secure escalation</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-[#9CA3AF] transition-colors hover:bg-[#1A1C20] hover:text-[#F5F5F7]"
                aria-label="Close support chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
              {sortedMessages.map((message) => (
                <ChatBubble key={message.id} message={message} />
              ))}
              {isTyping && (
                <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-md border border-[#2A2D33] bg-[#1A1D23] px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9CA3AF]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9CA3AF] [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9CA3AF] [animation-delay:240ms]" />
                  </div>
                </div>
              )}

              {showEscalation && (
                <div className="rounded-xl border border-[#2B3545] bg-[#151A23] px-3 py-3">
                  <p className="text-xs text-[#D1D5DB]">
                    If you still need help, you can contact our support team directly.
                  </p>
                  <a
                    href={TELEGRAM_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-[#229ED9] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1C8CC0]"
                  >
                    Contact Support on Telegram
                  </a>
                </div>
              )}
            </div>

            <form onSubmit={handleSend} className="border-t border-[#26272B] p-3">
              <div className="flex items-center gap-2 rounded-xl border border-[#2A2D33] bg-[#17181A] px-2 py-1.5">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  maxLength={320}
                  placeholder="Ask about deposits, withdrawals, levels..."
                  className="h-8 flex-1 bg-transparent px-1 text-xs text-[#F5F5F7] outline-none placeholder:text-[#6B7280]"
                />
                <button
                  type="submit"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#C6A15B] text-[#0F0F10] transition-colors hover:bg-[#D6B372]"
                  aria-label="Send message"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative">
        <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#3A2E18] bg-[#0F0F10] px-2 py-0.5 text-[10px] font-medium text-[#F5F5F7] shadow-[0_8px_20px_rgba(0,0,0,0.45)]">
          Support
        </span>
        <button
          type="button"
          onClick={openChat}
          className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#4A3A1F] bg-[#17181A] text-[#0F0F10] shadow-[0_16px_36px_rgba(0,0,0,0.55)] transition-all duration-150 hover:-translate-y-0.5 hover:border-[#C6A15B] hover:bg-[#1F2023] active:translate-y-0 active:scale-[0.98]"
          aria-label="Open support chat"
        >
          <img src={supportIcon} alt="" aria-hidden="true" className="h-6 w-6 object-contain drop-shadow-[0_0_2px_rgba(0,0,0,0.6)]" />
        </button>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.sender === "user";
  const isSystem = message.sender === "system";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-xs leading-relaxed ${
          isUser
            ? "rounded-br-md bg-[#C6A15B] text-[#0F0F10]"
            : isSystem
            ? "rounded-bl-md border border-[#2D3A2A] bg-[#122015] text-[#B6E5BD]"
            : "rounded-bl-md border border-[#2A2D33] bg-[#1A1D23] text-[#E5E7EB]"
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}
