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
  /**
   * The résumé itself, served straight out of public/ rather than rebuilt as a
   * panel: it is the one thing here a visitor may want to keep, forward or
   * print, and a PDF is the only form that survives all three.
   */
  resume: "/samuel-reade-resume.pdf",
  gmail: "mailto:sam5.reade@gmail.com",
  github: "https://github.com/Samuel-Reade",
  linkedin: "https://www.linkedin.com/in/samuelreade/",
} as const;
