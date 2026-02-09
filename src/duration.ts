const DURATION_PATTERN = /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+)m)?$/;

export function parseDuration(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) throw new Error(`Invalid duration: "${input}"`);

  const match = trimmed.match(DURATION_PATTERN);
  if (!match)
    throw new Error(
      `Invalid duration: "${input}". Use format like 1h30m, 2h, 45m, 1.5h`,
    );

  const hours = match[1] ? parseFloat(match[1]) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;

  if (hours < 0 || minutes < 0)
    throw new Error(`Duration cannot be negative: "${input}"`);

  const totalMs = hours * 3600000 + minutes * 60000;
  if (totalMs === 0)
    throw new Error(`Duration must be greater than zero: "${input}"`);

  return totalMs;
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}
