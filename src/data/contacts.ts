/**
 * The ways to reach Sam, in one place. The Connect panel's buttons and the
 * balcony telescope's ocean view both read from here, so a profile URL can
 * never be updated in one and left stale in the other.
 *
 * "#" means "not wired yet": the panel renders the button anyway, and the
 * telescope treats a click as a no-op rather than opening a blank tab.
 */
export const CONTACT = {
  phoneDisplay: "+1 (415) 887-8215",
  phone: "tel:+14158878215",
  gmail: "mailto:sam5.reade@gmail.com",
  github: "https://github.com/Samuel-Reade",
  // TODO(sam): the real profile URL.
  linkedin: "#",
} as const;
