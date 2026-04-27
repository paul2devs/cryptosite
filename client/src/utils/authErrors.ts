type ValidationErrorEntry = {
  msg?: string;
  message?: string;
  path?: string;
  param?: string;
};

type ApiErrorPayload = {
  message?: string;
  errors?: ValidationErrorEntry[];
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

export function mapAuthErrorMessage(rawMessage: string, fallback: string): string {
  const normalized = normalizeText(rawMessage);

  if (
    normalized.includes("invalid refresh token") ||
    normalized.includes("jwt expired") ||
    normalized.includes("token expired") ||
    normalized.includes("refresh token")
  ) {
    return "Your session has expired. Please log in again.";
  }

  if (normalized.includes("email already") || normalized.includes("already registered")) {
    return "Email already in use.";
  }

  if (normalized.includes("invalid credentials")) {
    return "Invalid email or password.";
  }

  if (normalized.includes("network error")) {
    return "Unable to connect right now. Please check your connection and try again.";
  }

  if (normalized.includes("validation failed")) {
    return "Invalid input. Please review your details and try again.";
  }

  return fallback;
}

export function extractAuthErrorMessage(error: unknown, fallback: string): string {
  const payload = (error as { response?: { data?: ApiErrorPayload } })?.response?.data;
  const directMessage = typeof payload?.message === "string" ? payload.message : "";
  if (directMessage) {
    return mapAuthErrorMessage(directMessage, fallback);
  }

  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    const first = payload.errors[0];
    const validationMessage =
      typeof first?.msg === "string"
        ? first.msg
        : typeof first?.message === "string"
          ? first.message
          : "";
    if (validationMessage) {
      return mapAuthErrorMessage(validationMessage, "Invalid input. Please review your details.");
    }
    return "Invalid input. Please review your details.";
  }

  const genericMessage = String((error as { message?: unknown })?.message || "");
  if (genericMessage) {
    return mapAuthErrorMessage(genericMessage, fallback);
  }

  return fallback;
}
