/** Stable product copy when auth email cannot be sent (SMTP not configured). */
export const AUTH_EMAIL_UNAVAILABLE_MESSAGE =
  "Email isn't available right now. Go back and continue with Google, or use another sign-in option.";

/** Stable product copy when register conflicts on email. */
export const AUTH_EMAIL_IN_USE_MESSAGE =
  "That email is already registered. Sign in or use a different email.";

/** Stable product copy when register conflicts on alias. */
export const AUTH_ALIAS_IN_USE_MESSAGE =
  "That alias is already taken. Choose a different one.";

/** Stable product copy when register returns a generic 409 conflict. */
export const AUTH_REGISTER_CONFLICT_MESSAGE =
  "That email or alias is already in use.";

const EMAIL_NOT_CONFIGURED = /Email delivery is not configured/i;
const EMAIL_IN_USE = /email.*already in use/i;
const ALIAS_IN_USE = /alias.*already in use/i;

const getErrorStatus = (err: unknown): number | undefined =>
  err && typeof err === "object" && "status" in err
    ? (err as { status?: unknown }).status
    : undefined;

const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err ?? "");

/**
 * Maps register / forgot-password failures when the API returns HTTP 503
 * or the fail-closed "Email delivery is not configured" message.
 */
export const describeAuthEmailError = (
  err: unknown,
  friendlyMessage: string = AUTH_EMAIL_UNAVAILABLE_MESSAGE
): string => {
  const status = getErrorStatus(err);
  const message = getErrorMessage(err);

  if (status === 503 || EMAIL_NOT_CONFIGURED.test(message)) {
    return friendlyMessage;
  }

  return message;
};

export type AuthRegisterErrorMessages = {
  emailUnavailable?: string;
  emailInUse?: string;
  aliasInUse?: string;
  conflict?: string;
};

/**
 * Maps register failures: HTTP 409 email/alias conflicts, then 503 /
 * fail-closed email-unavailable via {@link describeAuthEmailError}.
 */
export const describeAuthRegisterError = (
  err: unknown,
  messages: AuthRegisterErrorMessages = {}
): string => {
  const status = getErrorStatus(err);
  const message = getErrorMessage(err);

  if (status === 409) {
    if (EMAIL_IN_USE.test(message)) {
      return messages.emailInUse ?? AUTH_EMAIL_IN_USE_MESSAGE;
    }
    if (ALIAS_IN_USE.test(message)) {
      return messages.aliasInUse ?? AUTH_ALIAS_IN_USE_MESSAGE;
    }
    return messages.conflict ?? AUTH_REGISTER_CONFLICT_MESSAGE;
  }

  return describeAuthEmailError(
    err,
    messages.emailUnavailable ?? AUTH_EMAIL_UNAVAILABLE_MESSAGE
  );
};
