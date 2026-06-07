/** First name or friendly label from user profile. */
export function userDisplayName(user: {
  email: string;
  displayName: string | null;
}): string {
  if (user.displayName?.trim()) {
    const first = user.displayName.trim().split(/\s+/)[0];
    return first ?? user.displayName.trim();
  }
  const local = user.email.split("@")[0] ?? "";
  if (!local) return "there";
  const segment = local.split(/[._-]/)[0] ?? local;
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function greetingWithName(name: string): string {
  return `${timeGreeting()}, ${name}`;
}
