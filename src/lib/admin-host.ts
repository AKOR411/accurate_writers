export function isAdminHost(host: string | null): boolean {
  const configuredHostname = process.env.ADMIN_HOSTNAME?.trim().toLowerCase();
  if (!configuredHostname || !host) {
    return false;
  }

  try {
    const requestHostname = new URL(`https://${host.split(",")[0].trim()}`).hostname;
    return requestHostname.toLowerCase() === configuredHostname;
  } catch {
    return false;
  }
}
