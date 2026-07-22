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
  if (redisUrl) {
    const parsed = new URL(redisUrl);
    const isUpstash = parsed.hostname.includes("upstash.io");
    return {
      host: parsed.hostname,
      port: Number(parsed.port),
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      tls: parsed.protocol === "rediss:" ? {} : undefined,
      enableReadyCheck: !isUpstash,
      skipVersionCheck: isUpstash,
    };
  }
  return {
    host: fallbackHost,
    port: fallbackPort,
  };
}
