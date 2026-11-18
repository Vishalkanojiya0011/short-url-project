export function validateDestination(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return { error: "url is required and must be a non-empty string" };
  }

  let destination;
  try {
    destination = new URL(value.trim());
  } catch {
    return { error: "url must be a valid absolute URL" };
  }

  if (!["http:", "https:"].includes(destination.protocol)) {
    return { error: "url must use http or https" };
  }

  return { value: destination.toString() };
}

export function validateShortCode(value) {
  if (value === undefined) return {};
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]{3,32}$/.test(value)
  ) {
    return {
      error: "customCode must be 3-32 characters using letters, numbers, - or _",
    };
  }
  if (value.toLowerCase() === "health") {
    return { error: "customCode is reserved" };
  }

  return { value };
}
