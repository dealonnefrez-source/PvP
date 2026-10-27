export type GuildNotification = {
  kind: "event" | "lfg";
  title: string;
  description: string;
  url: string;
};

export function buildDiscordPayload(notification: GuildNotification) {
  const url = new URL(notification.url);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Linki w powiadomieniach muszą korzystać z HTTP lub HTTPS.");
  return {
    username: "Gildia Forever",
    allowed_mentions: { parse: [] },
    embeds: [{
      title: `${notification.kind === "event" ? "Nowe wydarzenie gildii" : "Nowa grupa"}: ${notification.title}`.slice(0, 256),
      description: notification.description.slice(0, 4096),
      url: url.toString(),
      color: 0xd4a843,
    }],
  };
}
