import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Paperclip, ImageOff, Eye, Download, FileText } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  isLikelyHtml,
  htmlToPlainText,
  getEmailSnippet,
  formatEmailFullDate,
  formatBytes,
  plaintextToEmailHtml,
  sanitizeEmailHtml,
  buildEmailIframeDoc,
} from "./email-utils";

export interface EmailAttachment {
  id?: string;
  name: string;
  url?: string;
  size?: number;
  contentType?: string;
}

export interface EmailMessageData {
  id: string;
  direction: "inbound" | "outbound";
  createdAt: string;
  body: string;
  // Field names below are best-guesses pending backend confirmation — see
  // the note in ChatWindow.tsx. All are optional and degrade gracefully.
  bodyHtml?: string;
  fromName?: string;
  fromEmail?: string;
  toEmail?: string;
  cc?: string;
  attachments?: EmailAttachment[];
}

interface EmailMessageCardProps {
  msg: EmailMessageData;
  fallbackName: string;
  defaultExpanded?: boolean;
}

function getInitials(name: string) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function EmailMessageCard({ msg, fallbackName, defaultExpanded = false }: EmailMessageCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showQuoted, setShowQuoted] = useState(false);
  const [allowImages, setAllowImages] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(80);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const isInbound = msg.direction === "inbound";
  const senderName = isInbound ? (msg.fromName || fallbackName) : "You";
  const senderEmail = msg.fromEmail || "";

  const rawHtml = msg.bodyHtml || (isLikelyHtml(msg.body) ? msg.body : undefined);

  // Build the iframe document fresh whenever the source content or the
  // image-blocking preference changes.
  const { srcDoc, blockedImageCount, quotedHtml } = useMemo(() => {
    if (rawHtml) {
      const { html, blockedImageCount } = sanitizeEmailHtml(rawHtml, allowImages);
      return { srcDoc: buildEmailIframeDoc(html), blockedImageCount, quotedHtml: null as string | null };
    }
    const { mainHtml, quotedHtml } = plaintextToEmailHtml(msg.body);
    return { srcDoc: buildEmailIframeDoc(mainHtml), blockedImageCount: 0, quotedHtml };
  }, [rawHtml, msg.body, allowImages]);

  const quotedSrcDoc = useMemo(
    () => (quotedHtml ? buildEmailIframeDoc(quotedHtml) : null),
    [quotedHtml]
  );

  const snippet = useMemo(() => getEmailSnippet(rawHtml ? htmlToPlainText(rawHtml) : msg.body, 90), [rawHtml, msg.body]);

  useEffect(() => {
    if (!expanded) return;
    const el = iframeRef.current;
    if (!el) return;
    const measure = () => {
      try {
        const doc = el.contentWindow?.document;
        if (doc?.body) setIframeHeight(Math.min(2400, Math.max(60, doc.body.scrollHeight + 12)));
      } catch {
        // Cross-origin measurement failure — keep last known height.
      }
    };
    el.addEventListener("load", measure);
    return () => el.removeEventListener("load", measure);
  }, [expanded, srcDoc]);

  const attachments = msg.attachments ?? [];

  return (
    <div
      className={cn(
        "rounded-xl border bg-white transition-colors",
        expanded ? "border-gray-200 shadow-sm" : "border-gray-100 hover:border-gray-200 cursor-pointer"
      )}
    >
      {/* ── Row header — always visible ───────────────────────────────── */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
      >
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black text-white shrink-0 mt-0.5",
            isInbound ? "bg-gradient-to-br from-rose-400 to-rose-600" : "bg-gradient-to-br from-[#004E98]/80 to-[#004E98]"
          )}
        >
          {getInitials(senderName)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-[13px] font-bold text-gray-900 truncate">{senderName}</span>
              {senderEmail && (
                <span className="text-[11px] text-gray-400 truncate hidden sm:inline">&lt;{senderEmail}&gt;</span>
              )}
            </div>
            <span className="text-[11px] text-gray-400 font-medium shrink-0">{formatEmailFullDate(msg.createdAt)}</span>
          </div>

          {!expanded && (
            <p className="text-[12px] text-gray-500 truncate mt-0.5 pr-2">{snippet}</p>
          )}

          {!expanded && attachments.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400 mt-1">
              <Paperclip size={10} /> {attachments.length} attachment{attachments.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="text-gray-300 shrink-0 mt-1">
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {/* ── Expanded body ──────────────────────────────────────────────── */}
      {expanded && (
        <div className="px-4 pb-4">
          {msg.toEmail && (
            <p className="text-[11px] text-gray-400 mb-2.5 pl-[44px]">
              to <span className="text-gray-500 font-medium">{msg.toEmail}</span>
              {msg.cc && <> · cc <span className="text-gray-500 font-medium">{msg.cc}</span></>}
            </p>
          )}

          <div className="pl-[44px]">
            {rawHtml && blockedImageCount > 0 && !allowImages && (
              <div className="flex items-center justify-between gap-3 mb-2.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                  <ImageOff size={12} />
                  {blockedImageCount} image{blockedImageCount > 1 ? "s" : ""} blocked to protect your privacy
                </span>
                <button
                  onClick={() => setAllowImages(true)}
                  className="flex items-center gap-1 text-[11px] font-bold text-[#004E98] hover:underline shrink-0"
                >
                  <Eye size={12} /> Display images
                </button>
              </div>
            )}

            <iframe
              ref={iframeRef}
              title={`email-${msg.id}`}
              srcDoc={srcDoc}
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              style={{ width: "100%", height: iframeHeight, border: "none", display: "block" }}
            />

            {quotedSrcDoc && (
              <div className="mt-1">
                <button
                  onClick={() => setShowQuoted((v) => !v)}
                  className="flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-gray-600 px-2 py-1 rounded-md hover:bg-gray-50"
                >
                  {showQuoted ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {showQuoted ? "Hide quoted text" : "Show quoted text"}
                </button>
                {showQuoted && (
                  <QuotedFrame srcDoc={quotedSrcDoc} />
                )}
              </div>
            )}

            {attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <a
                    key={a.id ?? i}
                    href={a.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors max-w-[220px]"
                  >
                    <FileText size={14} className="text-gray-400 shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[11px] font-bold text-gray-700 truncate">{a.name}</span>
                      {a.size ? <span className="block text-[10px] text-gray-400">{formatBytes(a.size)}</span> : null}
                    </span>
                    <Download size={12} className="text-gray-300 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Quoted/older portion of a plaintext email — rendered at a smaller auto height. */
function QuotedFrame({ srcDoc }: { srcDoc: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(60);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      try {
        const doc = el.contentWindow?.document;
        if (doc?.body) setHeight(Math.min(1200, Math.max(40, doc.body.scrollHeight + 8)));
      } catch {
        // ignore
      }
    };
    el.addEventListener("load", measure);
    return () => el.removeEventListener("load", measure);
  }, [srcDoc]);

  return (
    <iframe
      ref={ref}
      title="quoted-text"
      srcDoc={srcDoc}
      sandbox="allow-same-origin"
      className="mt-1.5 opacity-70"
      style={{ width: "100%", height, border: "none", display: "block" }}
    />
  );
}
