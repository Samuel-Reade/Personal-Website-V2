import { CONTACT } from "../../data/contacts";

/**
 * The four ways to reach me, named once for both ends of the telescope.
 *
 * The Connect balcony's lens shows two different scenes on the visitor's own
 * clock — by day the balloons flying beyond the associations range, by night
 * four bodies in the tech-stack sky — and both are the same four destinations
 * wearing different costumes. What they are *called* should not be one of the
 * things that changes with the hour.
 *
 * It was. The night view named them by where they land — "github.com/
 * Samuel-Reade", the address itself, the number itself — while the day view
 * named them by the thing you were pointing at: "Terracotta balloon —
 * GitHub". Hovering the same destination twelve hours apart told you two
 * different things, and one of them was about upholstery. The two also
 * quietly disagreed on the third: the day called it Gmail and the night
 * called it Email.
 *
 * So the words live here and each view imports them. What stays local to each
 * is only what is genuinely local — where a body orbits and what colour its
 * halo is, which balloon in the cluster carries which destination — because
 * those really are properties of the costume rather than of the person behind
 * it.
 */
export type ReachKey = "github" | "email" | "linkedin" | "phone";

export interface ReachTarget {
  /**
   * The short word. It is the pill beside a body at night and the extruded tag
   * standing beside a balloon by day, so it has to stay short enough to cut in
   * 3D letters and read at arm's length.
   */
  label: string;
  /**
   * What the caption line under the eyepiece reads while this one is hovered.
   *
   * The destination itself rather than a description of the thing on screen.
   * A visitor who has gone to the trouble of putting their eye to a telescope
   * has already seen that it is a green balloon; what they cannot see, and
   * what the line is for, is the address at the other end of it.
   */
  caption: string;
  /** Spoken label. Says what following it will do, which a caption need not. */
  aria: string;
  /** From `data/contacts.ts`, the one place a URL is written down. */
  href: string;
}

export const REACH_TARGETS: Record<ReachKey, ReachTarget> = {
  github: {
    label: "GitHub",
    caption: "github.com/Samuel-Reade",
    aria: "GitHub — open my profile in a new tab",
    href: CONTACT.github,
  },
  email: {
    label: "Email",
    caption: "sam5.reade@gmail.com",
    aria: "Email — sam5.reade@gmail.com",
    href: CONTACT.gmail,
  },
  linkedin: {
    label: "LinkedIn",
    caption: "linkedin.com/in/samuelreade",
    aria: "LinkedIn — open my profile in a new tab",
    href: CONTACT.linkedin,
  },
  phone: {
    label: "Phone",
    caption: CONTACT.phoneDisplay,
    aria: `Phone — ${CONTACT.phoneDisplay}`,
    href: CONTACT.phone,
  },
};
