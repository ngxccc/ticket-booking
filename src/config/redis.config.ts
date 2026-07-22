export interface RedisConnectionConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: Record<string, unknown>;
  enableReadyCheck?: boolean;
  skipVersionCheck?: boolean;
}

export function parseRedisOptions(
  redisUrl?: string,
  fallbackHost = "localhost",
  fallbackPort = 6379,
): RedisConnectionConfig {
  if (redisUrl && redisUrl.trim().length > 0) {
    try {
      const parsed = new URL(redisUrl);
      const isUpstash =
        parsed.hostname.endsWith(".upstash.io") ||
        parsed.hostname === "upstash.io";
      const port = Number(parsed.port) || fallbackPort;

      return {
        host: parsed.hostname,
        port,
        username: parsed.username || undefined,
        password: parsed.password || undefined,
        tls: parsed.protocol === "rediss:" ? {} : undefined,
        enableReadyCheck: !isUpstash,
        skipVersionCheck: isUpstash,
      };
    } catch {
      // Fallback gracefully on malformed or invalid Redis URL strings
    }
  }
  return {
    host: fallbackHost,
    port: fallbackPort,
  };
}
