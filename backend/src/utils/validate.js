// Basic input validation/sanitization helpers. SQL injection itself is
// already prevented throughout the app via parameterized queries ($1, $2
// style) — these helpers cover the other common risks: malformed input,
// oversized payloads, and obviously-fake emails.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return typeof email === "string" && email.length <= 254 && EMAIL_REGEX.test(email.trim());
}

function isValidName(name) {
  return typeof name === "string" && name.trim().length >= 1 && name.trim().length <= 100;
}

function isValidPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

function isValidDomain(domain) {
  if (typeof domain !== "string") return false;
  const cleaned = domain.trim().toLowerCase();
  return cleaned.length <= 253 && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(cleaned);
}

module.exports = { isValidEmail, isValidName, isValidPassword, isValidDomain };
