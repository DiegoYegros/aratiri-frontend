/** Stable product copy when auth email cannot be sent (SMTP not configured). */
export const AUTH_EMAIL_UNAVAILABLE_MESSAGE =
  "Email isn't available right now. Go back and continue with Google, or use another sign-in option.";

const EMAIL_NOT_CONFIGURED = /Email delivery is not configured/i;

/**
 * Maps register / forgot-password failures when the API returns HTTP 503
 * or the fail-closed "Email delivery is not configured" message.
 */
export const describeAuthEmailError = (
  err: unknown,
  friendlyMessage: string = AUTH_EMAIL_UNAVAILABLE_MESSAGE
): string => {
  const status =
    err && typeof err === "object" && "status" in err
      ? (err as { status?: unknown }).status
      : undefined;
  const message = err instanceof Error ? err.message : String(err ?? "");

  if (status === 503 || EMAIL_NOT_CONFIGURED.test(message)) {
    return friendlyMessage;
  }

  return message;
};
