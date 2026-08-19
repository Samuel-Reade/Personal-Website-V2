import { useEffect, useMemo, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import { CONTACT } from "../data/contacts";

/**
 * The card that gets my number into a visitor's phone: the one action that
 * actually does it, whichever way they arrived at asking.
 *
 * Two things open it — the phone planet in the telescope's eyepiece, and the
 * Phone row on the corner card — which is why it lives out here rather than
 * with the eyepiece it was written for. A `tel:` link is the obvious thing for
 * that row to be and very nearly a dead end: on a desk it hands off to whatever
 * claims the protocol, which is usually nothing at all. This is what the
 * telescope had already worked out, so the row does what the planet does.
 *
 * Which action that is depends on what they're holding, read from
 * `(pointer: coarse)` — the pointer, not the user agent, because the pointer
 * is the fact that matters. A coarse pointer *is* the phone, so the card
 * leads with saving the contact directly and offers no QR code (nobody can
 * scan their own screen). A fine pointer is a desk, where the phone is the
 * other device — so the card leads with a QR code to point it at, and keeps
 * a .vcf link underneath for Mac users whose contacts live on the desk too.
 *
 * Both branches end with the number as selectable, click-to-copy text — the
 * fallback that still works when everything cleverer doesn't.
 */

interface PhonePanelProps {
  /** Closes the card. The opener is expected to take focus back with it. */
  onClose: () => void;
}

/**
 * The QR payload: MECARD rather than a URL, so the contact details live in
 * the code itself and scanning works with no server and no connection.
 */
function mecard(): string {
  const tel = CONTACT.phone.replace(/^tel:/, "");
  const email = CONTACT.gmail.replace(/^mailto:/, "");
  return `MECARD:N:${CONTACT.lastName},${CONTACT.firstName};TEL:${tel};EMAIL:${email};URL:${CONTACT.linkedin};;`;
}

/** Quiet-zone modules around the code — the spec's four, in the card's own dark. */
const QUIET = 4;

/**
 * The code as one SVG path: a `h1v1` square per dark module. Light modules on
 * the card's dark ground — inverted codes scan fine on modern phone cameras,
 * and a white square would be the one thing on the night side of the site
 * that ignores where it is.
 */
function useQr(payload: string): { d: string; span: number } {
  return useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(payload);
    qr.make();
    const count = qr.getModuleCount();
    let d = "";
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`;
      }
    }
    return { d, span: count };
  }, [payload]);
}

/** How long "Copied" stands before the button reads "Copy" again. */
const COPIED_MS = 1600;

export function PhonePanel({ onClose }: PhonePanelProps) {
  // Read once per opening: a pointer doesn't change mid-visit, and the card
  // lives only while open.
  const coarse = useMemo(() => window.matchMedia("(pointer: coarse)").matches, []);
  const [copied, setCopied] = useState(false);
  const card = useRef<HTMLDivElement>(null!);
  const { d, span } = useQr(mecard());

  // The card takes focus on open so Escape and Tab start from it; whoever
  // opened it hands focus back to what was clicked on close.
  useEffect(() => {
    card.current.focus();
  }, []);

  /**
   * Escape closes it, and the card owns that rather than leaving it to whoever
   * opened it — it is a modal dialog, and a modal with no way out on the
   * keyboard is a trap. It was the eyepiece's job while the eyepiece was the
   * only way in; the corner card would have had to reinvent it, and the next
   * opener after that would have had to remember to.
   *
   * Bound on the capture phase and stopped there, so an opener with its own
   * Escape handling on the window doesn't also act on the same press: the
   * telescope's peels back one layer per press, and without this a single
   * Escape would close the card and lower the scope behind it.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    // A click mid-selection is someone selecting the number by hand — the
    // fallback this text exists for. Don't stamp over their clipboard.
    if (window.getSelection()?.toString()) return;
    try {
      await navigator.clipboard.writeText(CONTACT.phoneDisplay);
      setCopied(true);
    } catch {
      // No clipboard permission: the number is still selectable text.
    }
  };

  return (
    <div className="phone-card-scrim" onClick={onClose}>
      <div
        ref={card}
        className="phone-card"
        role="dialog"
        aria-modal="true"
        aria-label="Save my number"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="phone-card-close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        {coarse ? (
          <a className="phone-card-save" href={CONTACT.vcf} download>
            Save my contact
          </a>
        ) : (
          <>
            <svg
              className="phone-card-qr"
              viewBox={`${-QUIET} ${-QUIET} ${span + QUIET * 2} ${span + QUIET * 2}`}
              role="img"
              aria-label="QR code carrying my name, number and email"
              shapeRendering="crispEdges"
            >
              <path d={d} fill="currentColor" />
            </svg>
            <p className="phone-card-hint">Point your phone at this</p>
          </>
        )}

        <p className="phone-card-number">
          <span className="phone-card-digits" onClick={copy}>
            {CONTACT.phoneDisplay}
          </span>
          <button
            className="phone-card-copy"
            onClick={copy}
            aria-label="Copy my phone number"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </p>

        {!coarse && (
          <a className="phone-card-vcf" href={CONTACT.vcf} download>
            or download the .vcf
          </a>
        )}
      </div>
    </div>
  );
}
