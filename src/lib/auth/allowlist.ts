export function allowedEmails() {
  const listed = [
    ...(process.env.PLANCHECK_ALLOWED_EMAILS ?? "").split(","),
    ...(process.env.PLANCHECK_ALLOWED_EMAIL ?? "").split(","),
  ];
  return [...new Set(listed.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

export function isAllowedEmail(email: string | null | undefined): email is string {
  if (!email) {
    return false;
  }
  const allowed = allowedEmails();
  if (allowed.length === 0) {
    return false;
  }
  return allowed.includes(email.trim().toLowerCase());
}
