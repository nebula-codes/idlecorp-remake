export function createRequestKey(): string {
  // Unlike randomUUID(), getRandomValues() also works on plain HTTP LAN origins.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
