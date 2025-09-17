import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';

import { boards, db } from '@/lib/db';
import { subscribeBoard } from '@/lib/events';

function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: { boardId: string } }
) {
  const board = db.select().from(boards).where(eq(boards.slug, params.boardId)).get();
  if (!board) {
    return new Response('Board not found', { status: 404 });
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: { type: string; payload: unknown }) => {
        controller.enqueue(encoder.encode(encodeSse(event.type, event.payload)));
      };

      const unsubscribe = subscribeBoard(board.id, send);
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(': keepalive\n\n'));
      }, 20_000);

      send({ type: 'board.updated', payload: { id: board.id } });

      controller.enqueue(encoder.encode(': connected\n\n'));

      cleanup = () => {
        clearInterval(keepAlive);
        unsubscribe();
      };
    },
    cancel() {
      cleanup();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  });
}
