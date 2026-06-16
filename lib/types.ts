export type ItemType = "text" | "link" | "file";

export type UserRecord = {
  id: string;
  nick: string;
  display: string;
  admin: boolean;
};

export type ChannelRecord = {
  id: string;
  boardId: string;
  slug: string;
  name: string;
  position: number;
};

export type LinkPayload = {
  url: string;
  title: string;
  site: string;
  desc?: string;
  image?: string;
  youtube?: string;
};

export type FilePayload = {
  name: string;
  mime: string;
  size: number;
  preview?: string | null;
  dataUrl?: string | null;
};

export type ItemRecord = {
  id: string;
  boardId: string;
  channel: string;
  type: ItemType;
  user: UserRecord;
  session: number;
  t: number;
  body?: string;
  link?: LinkPayload;
  file?: FilePayload;
  pinned: boolean;
};

export type BoardPayload = {
  board: { id: string; displayName: string };
  channels: ChannelRecord[];
  items: ItemRecord[];
  reactions: Record<string, Record<string, string[]>>;
};
