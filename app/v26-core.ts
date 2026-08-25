export type PopupSnap = "left" | "right" | "full" | "none";

export type PopupGeometry = {
  width: number;
  height: number;
  left?: number;
  top?: number;
  minimized?: boolean;
  z?: number;
  snap?: PopupSnap;
};

export type PopupLayoutMap = Record<string, PopupGeometry>;

export type PagePeekState = {
  id: string;
  page: string;
  pinned: boolean;
};

export const popupLayoutStorageKey = "lcars-popup-layouts-v26";
export const openPeeksStorageKey = "lcars-open-page-peeks-v26";
export const workspaceCommandEvent = "lcars-workspace-command";
export const workspaceStateEvent = "lcars-workspace-state";

const number = (value: unknown, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

export const normalizePopupLayouts = (value: unknown): PopupLayoutMap => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, raw]) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
      const item = raw as Partial<PopupGeometry>;
      const width = number(item.width), height = number(item.height);
      if (width < 1 || height < 1) return [];
      const snap: PopupSnap =
        item.snap === "left" || item.snap === "right" || item.snap === "full"
          ? item.snap
          : "none";
      return [[key, {
        width,
        height,
        ...(Number.isFinite(Number(item.left)) ? { left: number(item.left) } : {}),
        ...(Number.isFinite(Number(item.top)) ? { top: number(item.top) } : {}),
        minimized: Boolean(item.minimized),
        z: Math.max(1, number(item.z, 1)),
        snap,
      } satisfies PopupGeometry]];
    }),
  );
};

export const fitPopupGeometry = (
  geometry: Partial<PopupGeometry>,
  viewport: { width: number; height: number },
  minimum: { width: number; height: number },
): PopupGeometry => {
  const margin = 8;
  const maxWidth = Math.max(160, viewport.width - margin * 2);
  const maxHeight = Math.max(140, viewport.height - margin * 2);
  const width = Math.min(maxWidth, Math.max(Math.min(minimum.width, maxWidth), number(geometry.width, minimum.width)));
  const height = Math.min(maxHeight, Math.max(Math.min(minimum.height, maxHeight), number(geometry.height, minimum.height)));
  const left = Math.min(viewport.width - margin - width, Math.max(margin, number(geometry.left, viewport.width - width - 20)));
  const top = Math.min(viewport.height - margin - height, Math.max(margin, number(geometry.top, viewport.height - height - 48)));
  return {
    width,
    height,
    left,
    top,
    minimized: Boolean(geometry.minimized),
    z: Math.max(1, number(geometry.z, 170)),
    snap: geometry.snap === "left" || geometry.snap === "right" || geometry.snap === "full" ? geometry.snap : "none",
  };
};

export const snapPopupGeometry = (
  side: PopupSnap,
  viewport: { width: number; height: number },
  minimum: { width: number; height: number },
  z = 170,
): PopupGeometry => {
  const margin = 8, gap = 6;
  if (side === "full") return fitPopupGeometry({ left: margin, top: margin, width: viewport.width - margin * 2, height: viewport.height - margin * 2, z, snap: side }, viewport, minimum);
  const width = Math.max(minimum.width, Math.floor((viewport.width - margin * 2 - gap) / 2));
  return fitPopupGeometry({
    left: side === "right" ? viewport.width - margin - width : margin,
    top: margin,
    width,
    height: viewport.height - margin * 2,
    z,
    snap: side,
  }, viewport, minimum);
};

export const arrangePopupWindows = (
  keys: string[],
  viewport: { width: number; height: number },
): PopupLayoutMap => {
  const visible = keys.filter((key, index) => key && keys.indexOf(key) === index);
  if (!visible.length) return {};
  const columns = viewport.width < 760 || visible.length === 1 ? 1 : visible.length <= 4 ? 2 : 3;
  const rows = Math.ceil(visible.length / columns), margin = 12, gap = 8;
  const width = Math.max(260, Math.floor((viewport.width - margin * 2 - gap * (columns - 1)) / columns));
  const height = Math.max(220, Math.floor((viewport.height - margin * 2 - gap * (rows - 1)) / rows));
  return Object.fromEntries(visible.map((key, index) => [key, {
    width,
    height,
    left: margin + (index % columns) * (width + gap),
    top: margin + Math.floor(index / columns) * (height + gap),
    minimized: false,
    z: 170 + index,
    snap: "none" as const,
  }]));
};

export const normalizePagePeeks = (value: unknown): PagePeekState[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Partial<PagePeekState>, page = String(item.page || "").slice(0, 120);
    if (!page) return [];
    const id = String(item.id || `peek-${page}-${index}`).replace(/[^a-z0-9:_-]/gi, "-").slice(0, 160);
    return [{ id, page, pinned: Boolean(item.pinned) }];
  }).filter((item, index, list) => list.findIndex((candidate) => candidate.page === item.page) === index).slice(0, 8);
};
