const DEFAULT_ALLOWED = [
  "vedalken.dev@gmail.com",
  "uwaism0502@gmail.com",
  "zunaed@boogertmandbn.co.za",
  "zunaed.ballim@gmail.com",
];

export function allowedEmails() {
  const listed = [
    ...DEFAULT_ALLOWED,
    ...(process.env.PLANCHECK_ALLOWED_EMAILS ?? "").split(","),
    ...(process.env.PLANCHECK_ALLOWED_EMAIL ?? "").split(","),
  ];
  return [...new Set(listed.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

export function isAllowedEmail(email: string | null | undefined): email is string {
  if (!email) {
    return false;
  }
  return allowedEmails().includes(email.trim().toLowerCase());
}
