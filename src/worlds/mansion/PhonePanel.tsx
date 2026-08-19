import { useEffect, useMemo, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import { CONTACT } from "../../data/contacts";

/**
 * What clicking the phone planet opens: a small card over the eyepiece with
 * the one action that actually gets my number into the visitor's phone.
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
  /** Closes the card; the eyepiece view returns focus to the phone planet. */
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

  // The card takes focus on open so Escape and Tab start from it; the
  // eyepiece view hands focus back to the phone planet on close.
  useEffect(() => {
    card.current.focus();
  }, []);

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
    <div className="eyepiece-phone-scrim" onClick={onClose}>
      <div
        ref={card}
        className="eyepiece-phone"
        role="dialog"
        aria-modal="true"
        aria-label="Save my number"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="eyepiece-phone-close"
          onClick={onClose}
          aria-label="Back to the telescope"
        >
          ✕
        </button>

        {coarse ? (
          <a className="eyepiece-phone-save" href={CONTACT.vcf} download>
            Save my contact
          </a>
        ) : (
          <>
            <svg
              className="eyepiece-phone-qr"
              viewBox={`${-QUIET} ${-QUIET} ${span + QUIET * 2} ${span + QUIET * 2}`}
              role="img"
              aria-label="QR code carrying my name, number and email"
              shapeRendering="crispEdges"
            >
              <path d={d} fill="currentColor" />
            </svg>
            <p className="eyepiece-phone-hint">Point your phone at this</p>
          </>
        )}

        <p className="eyepiece-phone-number">
          <span className="eyepiece-phone-digits" onClick={copy}>
            {CONTACT.phoneDisplay}
          </span>
          <button
            className="eyepiece-phone-copy"
            onClick={copy}
            aria-label="Copy my phone number"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </p>

        {!coarse && (
          <a className="eyepiece-phone-vcf" href={CONTACT.vcf} download>
            or download the .vcf
          </a>
        )}
      </div>
    </div>
  );
}
