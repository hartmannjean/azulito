export function getClientIpFromHeaders(headersList: Headers): string {
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]!.trim();
  }
  return headersList.get("x-real-ip") ?? "unknown";
}
