/**
 * Dashboard admins:
 * - MongoDB role "admin"
 * - These G Suite logins (must match Google sign-in exactly, usually @g.bracu.ac.bd)
 * - Plus any addresses in env ADMIN_PANEL_EMAILS (comma-separated)
 */
const DEFAULT_PANEL_ADMIN_EMAILS = [
  // Shehzad Hakim (add variants if Google uses a different local-part)
  "shehzad.hakim@g.bracu.ac.bd",
  // B M Muktadir Wafi — common G Suite / student formats
  "muktadir.wafi@g.bracu.ac.bd",
  "b.muktadir.wafi@g.bracu.ac.bd",
  "b.m.muktadir.wafi@g.bracu.ac.bd",
  "bmmuktadir.wafi@g.bracu.ac.bd",
];

/**
 * If email is not in the list above (e.g. 2210xxxx@g.bracu.ac.bd), we still grant access when the
 * display name matches the two course admins (name comes from Google at signup and is not edited in profile).
 */
function compactLetters(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function isDesignatedAdminByName(user) {
  const c = compactLetters(user.name);
  if (c.length < 4) return false;
  if (c.includes("shehzad") && c.includes("hakim")) return true;
  if (c.includes("muktadir") && c.includes("wafi")) return true;
  return false;
}

function emailsFromEnv() {
  return (process.env.ADMIN_PANEL_EMAILS || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function panelAdminEmailSet() {
  return new Set([
    ...DEFAULT_PANEL_ADMIN_EMAILS.map((e) => e.toLowerCase()),
    ...emailsFromEnv(),
  ]);
}

function parseAdminEmails() {
  return [...panelAdminEmailSet()];
}

function isDashboardAdminUser(user) {
  if (!user || !user.email) return false;
  if (user.role === "admin") return true;
  if (panelAdminEmailSet().has(String(user.email).toLowerCase())) return true;
  if (isDesignatedAdminByName(user)) return true;
  return false;
}

module.exports = {
  parseAdminEmails,
  isDashboardAdminUser,
  DEFAULT_PANEL_ADMIN_EMAILS,
  isDesignatedAdminByName,
};
