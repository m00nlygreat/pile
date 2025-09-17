import { EventEmitter } from 'node:events';

type BoardEvent = {
  type: 'item.created' | 'item.deleted' | 'channel.created' | 'board.updated';
  payload: unknown;
};

const emitters = new Map<string, EventEmitter>();

function getEmitter(boardId: string) {
  if (!emitters.has(boardId)) {
    emitters.set(boardId, new EventEmitter());
  }
  return emitters.get(boardId)!;
}

export function emitBoardEvent(boardId: string, event: BoardEvent) {
  const emitter = getEmitter(boardId);
  emitter.emit('event', event);
}

export function subscribeBoard(boardId: string, listener: (event: BoardEvent) => void) {
  const emitter = getEmitter(boardId);
  emitter.on('event', listener);
  return () => emitter.off('event', listener);
}
