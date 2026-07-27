export const ACCOUNT_VALIDATION_LIMITS = Object.freeze({
  nameMinLength: 2,
  nameMaxLength: 80,
  emailMaxLength: 254,
  passwordMinLength: 8,
  passwordMaxLength: 128
});

export function normalizeAccountName(value) {
  if (typeof value !== "string") return "";

  return value
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAccountEmail(value) {
  if (typeof value !== "string") return "";

  return value
    .trim()
    .toLowerCase();
}

export function createInitialAccountHandle(value) {
  const normalizedEmail = normalizeAccountEmail(value);
  const localPart = normalizedEmail.split("@")[0] || "";

  let rawHandle = localPart
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (rawHandle.length < 2) {
    rawHandle = rawHandle
      ? `${rawHandle}_`
      : "user";
  }

  return `@${rawHandle.slice(0, 20)}`;
}

export function normalizeAccountHandle(value) {
  if (typeof value !== "string") return "";

  const trimmedHandle = value.trim();
  if (!trimmedHandle) return "";

  return trimmedHandle.startsWith("@")
    ? trimmedHandle
    : `@${trimmedHandle}`;
}

export function isAccountHandleInUse(
  users,
  handle,
  { excludeUserId = null } = {}
) {
  const normalizedHandle =
    normalizeAccountHandle(handle).toLowerCase();

  if (
    !normalizedHandle ||
    !users ||
    typeof users !== "object" ||
    Array.isArray(users)
  ) {
    return false;
  }

  return Object.entries(users).some(([userId, userBucket]) => {
    const isExcludedUser =
      excludeUserId !== null &&
      String(userId) === String(excludeUserId);

    if (isExcludedUser) return false;

    const storedHandle = normalizeAccountHandle(
      userBucket?.profile?.handle
    ).toLowerCase();

    return storedHandle === normalizedHandle;
  });
}

export function createUniqueAccountHandle(users, email) {
  const initialHandle = createInitialAccountHandle(email);

  if (!isAccountHandleInUse(users, initialHandle)) {
    return initialHandle;
  }

  const baseHandle = initialHandle.slice(1);
  let suffixNumber = 2;

  while (true) {
    const suffix = `_${suffixNumber}`;
    const availableBaseLength = 20 - suffix.length;

    if (availableBaseLength < 1) {
      const error = new Error(
        "No se pudo generar un alias único."
      );

      error.code = "ACCOUNT_HANDLE_EXHAUSTED";
      throw error;
    }

    const candidate =
      `@${baseHandle.slice(0, availableBaseLength)}${suffix}`;

    if (!isAccountHandleInUse(users, candidate)) {
      return candidate;
    }

    suffixNumber += 1;
  }
}

export function validateAccountName(value) {
  const normalizedName = normalizeAccountName(value);

  const isValid =
    normalizedName.length >= ACCOUNT_VALIDATION_LIMITS.nameMinLength &&
    normalizedName.length <= ACCOUNT_VALIDATION_LIMITS.nameMaxLength;

  if (!isValid) {
    return {
      ok: false,
      error: "invalid_name"
    };
  }

  return {
    ok: true,
    value: normalizedName
  };
}

export function validateAccountEmail(value) {
  const normalizedEmail = normalizeAccountEmail(value);

  const isValid =
    normalizedEmail.length > 0 &&
    normalizedEmail.length <= ACCOUNT_VALIDATION_LIMITS.emailMaxLength &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

  if (!isValid) {
    return {
      ok: false,
      error: "invalid_email"
    };
  }

  return {
    ok: true,
    value: normalizedEmail
  };
}

export function validateRegistrationPassword(value) {
  if (typeof value !== "string") {
    return {
      ok: false,
      error: "invalid_password"
    };
  }

  const isValid =
    value.trim().length > 0 &&
    value.length >= ACCOUNT_VALIDATION_LIMITS.passwordMinLength &&
    value.length <= ACCOUNT_VALIDATION_LIMITS.passwordMaxLength;

  if (!isValid) {
    return {
      ok: false,
      error: "invalid_password"
    };
  }

  return {
    ok: true,
    value
  };
}

export function validateRegistrationAccount(input = {}) {
  const normalizedName = normalizeAccountName(input?.name);
  const normalizedEmail = normalizeAccountEmail(input?.email);
  const password =
    typeof input?.password === "string"
      ? input.password
      : "";

  if (
    !normalizedName ||
    !normalizedEmail ||
    !password.trim()
  ) {
    return {
      ok: false,
      error: "missing_fields"
    };
  }

  const nameResult = validateAccountName(normalizedName);
  if (!nameResult.ok) return nameResult;

  const emailResult = validateAccountEmail(normalizedEmail);
  if (!emailResult.ok) return emailResult;

  const passwordResult = validateRegistrationPassword(password);
  if (!passwordResult.ok) return passwordResult;

  return {
    ok: true,
    value: {
      name: nameResult.value,
      email: emailResult.value,
      password: passwordResult.value
    }
  };
}

export function isAccountEmailInUse(
  users,
  email,
  { excludeUserId = null } = {}
) {
  const normalizedEmail = normalizeAccountEmail(email);

  if (
    !normalizedEmail ||
    !users ||
    typeof users !== "object" ||
    Array.isArray(users)
  ) {
    return false;
  }

  return Object.entries(users).some(([userId, userBucket]) => {
    const isExcludedUser =
      excludeUserId !== null &&
      String(userId) === String(excludeUserId);

    if (isExcludedUser) return false;

    const storedEmail = normalizeAccountEmail(
      userBucket?.profile?.email
    );

    return storedEmail === normalizedEmail;
  });
}
