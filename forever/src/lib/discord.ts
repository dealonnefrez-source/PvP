import "server-only";

import { buildDiscordPayload, type GuildNotification } from "./discord-payload";

export async function notifyDiscord(notification: GuildNotification): Promise<{ sent: boolean; reason?: "disabled" }> {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) {
    console.info("Discord notifications are disabled: DISCORD_WEBHOOK_URL is not set.");
    return { sent: false, reason: "disabled" };
  }
  const url = new URL(webhook);
  if (url.protocol !== "https:" || url.hostname !== "discord.com" || !/^\/api\/webhooks\/\d+\/[^/]+$/.test(url.pathname)) {
    console.error("Discord webhook configuration is invalid.");
    throw new Error("Nieprawidłowa konfiguracja webhooka Discorda.");
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildDiscordPayload(notification)),
    signal: AbortSignal.timeout(5000),
    redirect: "error",
  });
  if (!response.ok) {
    console.error("Discord webhook rejected notification", { status: response.status });
    throw new Error(`Nie udało się wysłać powiadomienia na Discordzie (${response.status}).`);
  }
  return { sent: true };
}
