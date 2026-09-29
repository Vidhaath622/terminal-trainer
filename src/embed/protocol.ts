/**
 * Embed protocol: how a host page (any college website) talks to the widget.
 * Pure TypeScript - usable on both sides of the iframe boundary.
 *
 * Host -> widget:
 *   { type: "tt:init",  studentId?, problem?|problemId?, config? }
 *   { type: "tt:reset" }
 * Widget -> host:
 *   { type: "tt:ready",            problems: [{id,title,difficulty}] }
 *   { type: "tt:step:completed",   problemId, stepId, earned, max, durationMs }
 *   { type: "tt:problem:completed",problemId, earned, max, durationMs }
 *   { type: "tt:progress",         problemId, currentStepIndex, earned, max }
 */
import { problemSchema, type Problem } from "@/engine/schema";

export const EMBED_PREFIX = "tt:";

export interface EmbedInitMessage {
  type: "tt:init";
  /** host's own student identifier; echoed back in events */
  studentId?: string;
  /** inline custom problem (teacher-authored JSON) */
  problem?: unknown;
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

/** Validate an inline custom problem from the host. Returns the parsed Problem or an error list. */
export function parseHostProblem(data: unknown): { ok: true; problem: Problem } | { ok: false; errors: string[] } {
  const result = problemSchema.safeParse(data);
  if (result.success) return { ok: true, problem: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
  };
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
