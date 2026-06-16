import type { ChannelRecord } from "@/lib/types";

export const DEFAULT_CHANNELS = [
  { id: "default", slug: "default", name: "일반" },
];

export const seedChannels = (boardId: string): ChannelRecord[] =>
  DEFAULT_CHANNELS.map((channel, position) => ({ ...channel, boardId, position }));
