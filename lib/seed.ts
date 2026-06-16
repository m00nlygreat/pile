import type { ChannelRecord } from "@/lib/types";

export const DEFAULT_CHANNELS = [
  { id: "default", name: "일반" },
  { id: "homework", name: "과제" },
  { id: "qna", name: "Q&A" },
  { id: "resources", name: "자료실" },
];

export const seedChannels = (boardId: string): ChannelRecord[] =>
  DEFAULT_CHANNELS.map((channel, position) => ({ ...channel, boardId, position }));
