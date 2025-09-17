import { notFound } from 'next/navigation';

import { BoardClient } from '@/components/board-client';
import { isAdmin } from '@/lib/admin';
import { fetchBoardData } from './data';

export const dynamic = 'force-dynamic';

export default async function BoardPage({ params }: { params: { boardId: string } }) {
  const data = await fetchBoardData(params.boardId);
  if (!data) {
    notFound();
  }
  const admin = isAdmin();

  return (
    <BoardClient
      boardSlug={data.board.slug}
      boardName={data.board.name}
      defaultChannelId={data.board.defaultChannelId ?? data.channels[0]?.id ?? ''}
      sessionBlockMinutes={data.board.sessionBlockMinutes}
      channels={data.channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        slug: channel.slug
      }))}
      initialItems={data.items}
      isAdmin={admin}
    />
  );
}
