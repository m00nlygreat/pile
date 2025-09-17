import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, lt } from 'drizzle-orm';
import { z } from 'zod';

import { getOrCreateAnonUser } from '@/lib/anon';
import { boardMembers, boards, channels, db, items, anonUsers } from '@/lib/db';
import { emitBoardEvent } from '@/lib/events';
import { fetchLinkMetadata } from '@/lib/og';
import { calculateSessionStart } from '@/lib/session';
import { saveUpload } from '@/lib/uploads';
import { createId, nowUnixSeconds } from '@/lib/utils';
import type { ItemWithRelations } from '@/components/item-card';

const createItemSchema = z.object({
  type: z.enum(['text', 'link', 'file']),
  channelId: z.string().optional(),
  text: z.string().max(5000).optional(),
  url: z.string().url().optional()
});

function mapRowToItem(row: {
  item: typeof items.$inferSelect;
  channel: typeof channels.$inferSelect | null;
  anon: typeof anonUsers.$inferSelect | null;
}): ItemWithRelations | null {
  if (!row.item || !row.channel) return null;
  return {
    id: row.item.id,
    type: row.item.type as ItemWithRelations['type'],
    textMd: row.item.textMd,
    filePath: row.item.filePath,
    fileMime: row.item.fileMime,
    fileSize: row.item.fileSize ?? undefined,
    fileOriginalName: row.item.fileOriginalName,
    linkUrl: row.item.linkUrl,
    linkTitle: row.item.linkTitle,
    linkDesc: row.item.linkDesc,
    linkImage: row.item.linkImage,
    createdAt: Number(row.item.createdAt),
    sessionStart: row.item.sessionStart ?? undefined,
    channel: {
      id: row.channel.id,
      name: row.channel.name,
      slug: row.channel.slug
    },
    anonUser: row.anon
      ? {
          id: row.anon.id,
          nickname: row.anon.nickname,
          displayName: row.anon.displayName
        }
      : null
  } satisfies ItemWithRelations;
}

async function resolveBoardAndChannel(boardSlug: string, channelHint?: string) {
  const board = db.select().from(boards).where(eq(boards.slug, boardSlug)).get();
  if (!board) return null;
  let channel: typeof channels.$inferSelect | undefined;
  if (channelHint) {
    channel = db
      .select()
      .from(channels)
      .where(and(eq(channels.boardId, board.id), eq(channels.id, channelHint)))
      .get();
    if (!channel) {
      channel = db
        .select()
        .from(channels)
        .where(and(eq(channels.boardId, board.id), eq(channels.slug, channelHint)))
        .get();
    }
  }
  if (!channel) {
    if (board.defaultChannelId) {
      channel = db.select().from(channels).where(eq(channels.id, board.defaultChannelId)).get();
    }
    if (!channel) {
      channel = db.select().from(channels).where(eq(channels.boardId, board.id)).get();
    }
  }
  return { board, channel };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { boardId: string } }
) {
  const search = request.nextUrl.searchParams;
  const channelFilter = search.get('channelId') ?? undefined;
  const since = search.get('since');

  const data = await resolveBoardAndChannel(params.boardId, channelFilter ?? undefined);
  if (!data?.board) {
    return NextResponse.json({ message: '보드를 찾을 수 없습니다.' }, { status: 404 });
  }

  const conditions = [eq(items.boardId, data.board.id)];
  if (channelFilter && data.channel) {
    conditions.push(eq(items.channelId, data.channel.id));
  }
  if (since) {
    const sinceValue = Number(since);
    if (!Number.isNaN(sinceValue)) {
      conditions.push(lt(items.createdAt, sinceValue));
    }
  }

  const condition = conditions.length > 1 ? and(...conditions) : conditions[0];

  const rows = db
    .select({ item: items, channel: channels, anon: anonUsers })
    .from(items)
    .leftJoin(channels, eq(items.channelId, channels.id))
    .leftJoin(anonUsers, eq(items.anonUserId, anonUsers.id))
    .where(condition)
    .orderBy(desc(items.createdAt))
    .limit(100)
    .all();
  const mapped = rows.map(mapRowToItem).filter(Boolean) as ItemWithRelations[];

  return NextResponse.json({ items: mapped });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { boardId: string } }
) {
  const data = await resolveBoardAndChannel(params.boardId);
  if (!data?.board) {
    return NextResponse.json({ message: '보드를 찾을 수 없습니다.' }, { status: 404 });
  }

  const anon = await getOrCreateAnonUser();

  let channel = data.channel;
  let payload: z.infer<typeof createItemSchema> | null = null;

  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const type = form.get('type')?.toString() ?? 'file';
    const channelHint = form.get('channelId')?.toString();
    if (channelHint) {
      const resolved = await resolveBoardAndChannel(params.boardId, channelHint);
      if (resolved?.channel) channel = resolved.channel;
    }
    if (type !== 'file') {
      return NextResponse.json({ message: 'multipart 요청은 파일 업로드만 지원합니다.' }, { status: 400 });
    }
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ message: '파일이 필요합니다.' }, { status: 400 });
    }
    if (!channel) {
      return NextResponse.json({ message: '채널을 찾을 수 없습니다.' }, { status: 404 });
    }
    const saved = await saveUpload(file);
    const sessionStart = data.board.sessionBlockMinutes
      ? calculateSessionStart(data.board, new Date())
      : new Date();
    const itemId = createId('item');
    const now = nowUnixSeconds();

    db.insert(items)
      .values({
        id: itemId,
        boardId: data.board.id,
        channelId: channel.id,
        anonUserId: anon?.id,
        type: 'file',
        filePath: saved.relativePath,
        fileMime: saved.mime,
        fileSize: saved.size,
        fileOriginalName: saved.originalName,
        sessionStart: Math.floor(sessionStart.getTime() / 1000),
        createdAt: now,
        updatedAt: now
      })
      .run();

    if (anon) {
      db
        .insert(boardMembers)
        .values({ boardId: data.board.id, anonUserId: anon.id, joinedAt: now })
        .onConflictDoNothing()
        .run();
    }

    const inserted = db
      .select({ item: items, channel: channels, anon: anonUsers })
      .from(items)
      .where(eq(items.id, itemId))
      .leftJoin(channels, eq(items.channelId, channels.id))
      .leftJoin(anonUsers, eq(items.anonUserId, anonUsers.id))
      .get();

    const mapped = inserted ? mapRowToItem(inserted) : null;
    if (mapped) {
      emitBoardEvent(data.board.id, { type: 'item.created', payload: mapped });
    }

    return NextResponse.json({ item: mapped });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = createItemSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ message: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
  }
  payload = parsed.data;

  if (payload.channelId) {
    const resolved = await resolveBoardAndChannel(params.boardId, payload.channelId);
    if (resolved?.channel) channel = resolved.channel;
  }

  if (!channel) {
    return NextResponse.json({ message: '채널을 찾을 수 없습니다.' }, { status: 404 });
  }

  const now = nowUnixSeconds();
  const sessionStart = data.board.sessionBlockMinutes
    ? calculateSessionStart(data.board, new Date())
    : new Date();
  const sessionEpoch = Math.floor(sessionStart.getTime() / 1000);

  const itemId = createId('item');

  if (payload.type === 'text') {
    if (!payload.text?.trim()) {
      return NextResponse.json({ message: '내용을 입력해 주세요.' }, { status: 400 });
    }
    db.insert(items)
      .values({
        id: itemId,
        boardId: data.board.id,
        channelId: channel.id,
        anonUserId: anon?.id,
        type: 'text',
        textMd: payload.text,
        sessionStart: sessionEpoch,
        createdAt: now,
        updatedAt: now
      })
      .run();
  } else if (payload.type === 'link') {
    if (!payload.url) {
      return NextResponse.json({ message: '링크 주소가 필요합니다.' }, { status: 400 });
    }
    const meta = await fetchLinkMetadata(payload.url);
    db.insert(items)
      .values({
        id: itemId,
        boardId: data.board.id,
        channelId: channel.id,
        anonUserId: anon?.id,
        type: 'link',
        linkUrl: payload.url,
        linkTitle: meta.title ?? payload.url,
        linkDesc: meta.description,
        linkImage: meta.image,
        sessionStart: sessionEpoch,
        createdAt: now,
        updatedAt: now
      })
      .run();
  } else {
    return NextResponse.json({ message: '파일 업로드는 multipart/form-data를 사용하세요.' }, { status: 400 });
  }

  if (anon) {
    db
      .insert(boardMembers)
      .values({ boardId: data.board.id, anonUserId: anon.id, joinedAt: now })
      .onConflictDoNothing()
      .run();
  }

  const inserted = db
    .select({ item: items, channel: channels, anon: anonUsers })
    .from(items)
    .where(eq(items.id, itemId))
    .leftJoin(channels, eq(items.channelId, channels.id))
    .leftJoin(anonUsers, eq(items.anonUserId, anonUsers.id))
    .get();

  const mapped = inserted ? mapRowToItem(inserted) : null;
  if (mapped) {
    emitBoardEvent(data.board.id, { type: 'item.created', payload: mapped });
  }

  return NextResponse.json({ item: mapped });
}
