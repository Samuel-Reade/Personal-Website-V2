import { useCallback, useRef, useState } from "react";
import { useStore } from "../state/useStore";
import { CONTACT } from "../data/contacts";
import { PhonePanel } from "./PhonePanel";

/**
 * The handle at the end of a profile URL — ".../in/samuelreade/" reads back as
 * "samuelreade". The card shows these rather than the full URLs because a
 * 232px card can't hold one, and the row's label already says which site it is.
 */
function handle(url: string) {
  return url.replace(/\/+$/, "").split("/").pop() ?? url;
}

interface ContactRow {
  /** Which way in: the row's left column. */
  label: string;
  /** What to show for it — a number, an address, a handle. */
  value: string;
  href: string;
  /** A profile opens in its own tab; a tel: or mailto: must not — see below. */
  external?: boolean;
  /** Opens the phone card instead of following the href — see below. */
  opensPhoneCard?: boolean;
}

/**
 * The same four ways to reach me the telescope shows, read from the same place
 * it reads them: `data/contacts.ts`. The eyepiece hangs them on an anchor, a
 * lighthouse, a bottle and a bell buoy, which is lovely and also several rooms
 * away from wherever the visitor happens to be standing — this is the plain
 * list, reachable from any world.
 */
const ROWS: ContactRow[] = [
  { label: "Phone", value: CONTACT.phoneDisplay, href: CONTACT.phone, opensPhoneCard: true },
  { label: "Email", value: CONTACT.gmail.replace(/^mailto:/, ""), href: CONTACT.gmail },
  { label: "GitHub", value: handle(CONTACT.github), href: CONTACT.github, external: true },
  { label: "LinkedIn", value: handle(CONTACT.linkedin), href: CONTACT.linkedin, external: true },
];

/**
 * The contact card: the controls key's twin, one seat to its left.
 *
 * Same shell, same slot, same layer — and deliberately not its own invention,
 * because two differently-dressed popups in one corner would read as two
 * unrelated pieces of chrome rather than as the pair of things the corner
 * offers. The two share that slot through `cornerCard` in the store, so opening
 * this one puts the controls key away and vice versa; neither ever covers the
 * other.
 *
 * No auto-dismiss, unlike the controls key. That card shows itself uninvited on
 * every arrival and so owes the visitor a way out of the way; this one only
 * ever appears because someone asked for it, and a card that vanished mid-read
 * while they were copying a phone number would be a bug.
 */
export function ContactCard() {
  const activePanel = useStore((s) => s.activePanel);
  const open = useStore((s) => s.cornerCard === "contact");
  const setCornerCard = useStore((s) => s.setCornerCard);
  const toggleCornerCard = useStore((s) => s.toggleCornerCard);

  const toggle = useCallback(() => toggleCornerCard("contact"), [toggleCornerCard]);
  const close = useCallback(() => setCornerCard(null), [setCornerCard]);

  /**
   * The phone card, and the row that opened it so focus has somewhere to go
   * back to — the same contract the eyepiece keeps with its phone planet.
   */
  const [phoneCard, setPhoneCard] = useState(false);
  const phoneRow = useRef<HTMLAnchorElement | null>(null);
  // Stable, because the card binds its Escape handler to it — a fresh closure
  // every render would have it unbinding and rebinding on each one.
  const closePhoneCard = useCallback(() => {
    setPhoneCard(false);
    // Back to the row it came from, as the eyepiece does with its planet.
    phoneRow.current?.focus();
  }, []);

  // Steps aside under a panel exactly as the controls key does: the panel comes
  // in over this corner, and the Connect panel in particular is this same list.
  if (activePanel) return null;

  return (
    <>
      <div id="contact-card" className={`contact-card${open ? " is-open" : ""}`}>
        <div className="contact-card-head">
          {/* "Connect" rather than "Contact", which is the name the rest of the
              site already uses for this: the sign over the hall's balcony
              doorway, and the panel behind it that is this same list. The class
              names and the store's slot key stay "contact" — they describe what
              the card holds, which has not changed. */}
          <span>Connect</span>
          <button className="contact-close" onClick={close} aria-label="Hide the ways to reach me">
            ✕
          </button>
        </div>
        <div className="contact-list">
          {ROWS.map((row) => (
            <div className="contact-row" key={row.label}>
              <span className="contact-row-label">{row.label}</span>
              {/* "#" is contacts.ts's marker for "not wired yet". The row still
                  shows — the way to reach me exists either way — but as text,
                  rather than as a link that opens a blank tab. */}
              {row.href === "#" ? (
                <span className="contact-row-value">{row.value}</span>
              ) : (
                <a
                  className="contact-row-value"
                  href={row.href}
                  ref={row.opensPhoneCard ? phoneRow : undefined}
                  // Phone opens the card the telescope opens rather than
                  // following its own href: on a desk a tel: link hands off to
                  // whatever claims the protocol, which is usually nothing, and
                  // the card is where the QR code and the .vcf are. The href
                  // stays a real tel: underneath it, so copying the link or
                  // opening it in the usual ways still gets the number.
                  onClick={
                    row.opensPhoneCard
                      ? (e) => {
                          e.preventDefault();
                          setPhoneCard(true);
                        }
                      : undefined
                  }
                  // No target on tel: or mailto:: handing those to a new tab
                  // leaves an empty one behind once the handler takes over.
                  {...(row.external ? { target: "_blank", rel: "noreferrer" } : {})}
                >
                  {row.value}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      <button
        className="contact-toggle"
        onClick={toggle}
        aria-controls="contact-card"
        aria-expanded={open}
      >
        Connect
      </button>

      {phoneCard && <PhonePanel onClose={closePhoneCard} />}
    </>
  );
}
