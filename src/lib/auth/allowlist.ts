export function allowedEmail() {
  return process.env.PLANCHECK_ALLOWED_EMAIL?.trim().toLowerCase() ?? "";
}

export function isAllowedEmail(email: string | null | undefined): email is string {
  const allowed = allowedEmail();
  if (!allowed || !email) {
    return false;
  }
  return email.trim().toLowerCase() === allowed;
}
