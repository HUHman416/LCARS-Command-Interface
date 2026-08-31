export type MediaSourceIdentity = {
  id: string;
  name: string;
  status?: string;
  aliases?: string[];
};

const normalize = (value: unknown) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const mediaSourceAliases = (source: Pick<MediaSourceIdentity, "id" | "name">) => {
  const identity = normalize(`${source.id} ${source.name}`);
  const aliases = new Set([normalize(source.id), normalize(source.name)]);
  if (/spotify/.test(identity)) ["spotify", "spotify music"].forEach((item) => aliases.add(item));
  if (/chromium|chrome|opera|vivaldi|brave|edge/.test(identity)) {
    ["browser", "chromium", "chrome", "google chrome", "opera", "opera gx", "vivaldi", "brave", "edge"].forEach((item) => aliases.add(item));
  }
  if (/firefox/.test(identity)) ["browser", "firefox", "mozilla firefox"].forEach((item) => aliases.add(item));
  if (/vlc/.test(identity)) ["vlc", "vlc media player"].forEach((item) => aliases.add(item));
  return Array.from(aliases).filter(Boolean);
};

export const matchMediaSource = (sources: MediaSourceIdentity[], requested: unknown) => {
  const query = normalize(requested).replace(/^(?:the|my)\s+/, "");
  if (!query) return null;
  const exact = sources.find((source) => mediaSourceAliases(source).includes(query));
  if (exact) return exact;
  return sources.find((source) => mediaSourceAliases(source).some((alias) => alias.includes(query) || query.includes(alias))) || null;
};

export const preferredMediaSource = (sources: MediaSourceIdentity[], command: unknown, requested?: unknown) => {
  const named = matchMediaSource(sources, requested);
  if (requested && !named) return null;
  if (named) return named;
  const action = normalize(command);
  const wanted = action === "pause" ? ["playing", "paused", "stopped"] : action === "play" || action === "resume" ? ["paused", "stopped", "playing"] : ["playing", "paused", "stopped"];
  return [...sources].sort((left, right) => {
    const leftRank = wanted.indexOf(normalize(left.status));
    const rightRank = wanted.indexOf(normalize(right.status));
    return (leftRank < 0 ? wanted.length : leftRank) - (rightRank < 0 ? wanted.length : rightRank);
  })[0] || null;
};
