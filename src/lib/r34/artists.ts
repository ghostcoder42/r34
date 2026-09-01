/**
 * Chip label for a site model (artist). The site appends a role to some model
 * display names in parentheses — "(VA)" for voice actors, "(Audio)" for audio
 * work — e.g. "OpenNSFW (VA)". Promote a known role to the label prefix and
 * strip it from the name: "VA: OpenNSFW". Models without a known role keep
 * the generic "Artist: Name" (with their name untouched, parenthetical
 * included — it may carry meaning we don't want to silently drop).
 */
const ROLE_PREFIXES = new Set(['VA', 'Audio', 'Artist']);

export function artistChipLabel(name: string): string {
  const match = name.match(/^(.+?)\s*\(([^()]+)\)$/);
  const role = match?.[2].trim();
  if (match && role && ROLE_PREFIXES.has(role)) {
    return `${role}: ${match[1].trim()}`;
  }
  return `Artist: ${name}`;
}
