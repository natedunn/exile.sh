/** Discord's boolean verification signal is mandatory; never invent an email. */
export function hasVerifiedDiscordEmail(profile: {
  email?: unknown
  verified?: unknown
}): profile is { email: string; verified: true } {
  return (
    profile.verified === true &&
    typeof profile.email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)
  )
}

export function usernameBase(name: string) {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "")
    .slice(0, 24)
  return normalized.length >= 2 ? normalized : "exile"
}
