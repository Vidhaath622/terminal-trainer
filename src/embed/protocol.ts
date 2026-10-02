/**
 * Embed protocol: how a host page (any college website) talks to the widget.
 * Pure TypeScript - usable on both sides of the iframe boundary.
 *
 * Host -> widget:
 *   { type: "tt:init",  studentId?, problemId?, config? }
 *   { type: "tt:reset" }
 *   (inline host-authored `problem` JSON was removed: remote pages must not
 *    author content through the widget — use a built-in problemId)
 * Widget -> host:
 *   { type: "tt:ready",            problems: [{id,title,difficulty}] }
 *   { type: "tt:step:completed",   problemId, stepId, earned, max, durationMs }
 *   { type: "tt:problem:completed",problemId, earned, max, durationMs }
 *   { type: "tt:progress",         problemId, currentStepIndex, earned, max }
 */
export const EMBED_PREFIX = "tt:";

export interface EmbedInitMessage {
  type: "tt:init";
  /** host's own student identifier; echoed back in events */
  studentId?: string;
  /** pick from the built-in launch set */
  problemId?: string;
  config?: {
    /** auto-run Verify after every command (default true) */
    autoVerify?: boolean;
    /** show hints button (default true) */
    hints?: boolean;
  };
}

export interface EmbedResetMessage {
  type: "tt:reset";
}

export interface EmbedReadyMessage {
  type: "tt:ready";
  problems: { id: string; title: string; difficulty: string }[];
}

export interface EmbedStepCompletedMessage {
  type: "tt:step:completed";
  studentId?: string;
  problemId: string;
  stepId: string;
  earned: number;
  max: number;
  durationMs: number;
}

export interface EmbedProblemCompletedMessage {
  type: "tt:problem:completed";
  studentId?: string;
  problemId: string;
  earned: number;
  max: number;
  durationMs: number;
}

export interface EmbedProgressMessage {
  type: "tt:progress";
  studentId?: string;
  problemId: string;
  currentStepIndex: number;
  earned: number;
  max: number;
}

export type WidgetToHostMessage =
  | EmbedReadyMessage
  | EmbedStepCompletedMessage
  | EmbedProblemCompletedMessage
  | EmbedProgressMessage;

export type HostToWidgetMessage = EmbedInitMessage | EmbedResetMessage;

export function isHostToWidget(data: unknown): data is HostToWidgetMessage {
  if (typeof data !== "object" || data === null) return false;
  const t = (data as { type?: unknown }).type;
  return t === "tt:init" || t === "tt:reset";
}

/**
 * Inline host-authored problems were removed: a remote page must not be able
 * to author content through the widget. True when a host message still
 * carries a `problem` payload — checked at runtime so an untyped JS host
 * cannot slip one past the TypeScript types.
 */
export function hasInlineAuthoringAttempt(msg: unknown): boolean {
  if (typeof msg !== "object" || msg === null) return false;
  return (msg as Record<string, unknown>).problem !== undefined;
}

/**
 * Parse a `?origin=` allowlist (comma-separated origins) into normalized
 * origin strings. Empty list = no restriction: the widget accepts messages
 * from whatever site embeds it, as the public docs promise.
 */
export function parseAllowedOrigins(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    try {
      const url = new URL(trimmed);
      if (url.protocol === "http:" || url.protocol === "https:") out.push(url.origin);
    } catch {
      // ignore junk entries rather than failing the whole list
    }
  }
  return out;
}

export interface HostMessageContext {
  /** event.origin of the incoming message */
  origin: string;
  /** true when event.source === window.parent */
  sourceIsParent: boolean;
  /** allowed parent origins; [] accepts any (public embed) */
  allowedOrigins: string[];
}

/**
 * Should this host command be acted on? Only the embedding page (the parent
 * window) may drive the widget, and — when the host pinned origins with
 * `?origin=` — only from one of those origins.
 */
export function isAllowedHostMessage(ctx: HostMessageContext): boolean {
  if (!ctx.sourceIsParent) return false;
  if (ctx.allowedOrigins.length === 0) return true;
  return ctx.allowedOrigins.includes(ctx.origin);
}

/**
 * Host-side helper: create a widget controller around an iframe.
 * Lightweight enough to paste into any college website.
 */
export function connectWidget(
  iframe: HTMLIFrameElement,
  handlers: {
    onReady?: (msg: EmbedReadyMessage) => void;
    onStepCompleted?: (msg: EmbedStepCompletedMessage) => void;
    onProblemCompleted?: (msg: EmbedProblemCompletedMessage) => void;
    onProgress?: (msg: EmbedProgressMessage) => void;
  } = {}
): {
  init: (msg: Omit<EmbedInitMessage, "type">) => void;
  reset: () => void;
  detach: () => void;
} {
  const listener = (event: MessageEvent) => {
    if (event.source !== iframe.contentWindow) return;
    const data = event.data as WidgetToHostMessage;
    if (typeof data !== "object" || data === null) return;
    const type = (data as { type?: string }).type;
    if (typeof type !== "string" || !type.startsWith(EMBED_PREFIX)) return;
    if (handlers.onReady && type === "tt:ready") handlers.onReady(data as EmbedReadyMessage);
    if (handlers.onStepCompleted && type === "tt:step:completed") handlers.onStepCompleted(data as EmbedStepCompletedMessage);
    if (handlers.onProblemCompleted && type === "tt:problem:completed") handlers.onProblemCompleted(data as EmbedProblemCompletedMessage);
    if (handlers.onProgress && type === "tt:progress") handlers.onProgress(data as EmbedProgressMessage);
  };
  window.addEventListener("message", listener);
  return {
    init: (msg) => iframe.contentWindow?.postMessage({ ...msg, type: "tt:init" }, "*"),
    reset: () => iframe.contentWindow?.postMessage({ type: "tt:reset" }, "*"),
    detach: () => window.removeEventListener("message", listener),
  };
}
