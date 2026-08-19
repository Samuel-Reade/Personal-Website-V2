/**
 * The ways to reach Sam, in one place. The Connect panel's buttons and the
 * balcony telescope's ocean view both read from here, so a profile URL can
 * never be updated in one and left stale in the other.
 *
 * "#" means "not wired yet": the panel renders the button anyway, and the
 * telescope treats a click as a no-op rather than opening a blank tab.
 */
export const CONTACT = {
  firstName: "Sam",
  lastName: "Reade",
  phoneDisplay: "+1 (415) 887-8215",
  phone: "tel:+14158878215",
  /**
   * The card in public/ carries the same name, number, email and profiles as
   * this object — it is a static file, so it can't read them from here. Change
   * one, change both.
   */
  vcf: "/sam-reade.vcf",
  gmail: "mailto:sam5.reade@gmail.com",
  github: "https://github.com/Samuel-Reade",
  linkedin: "https://www.linkedin.com/in/samuelreade/",
} as const;
