export type UnreadConversationCounts = ReadonlyMap<string, number>;

function mapsEqual(
  left: ReadonlyMap<string, number>,
  right: ReadonlyMap<string, number>,
): boolean {
  if (left.size !== right.size) return false;
  for (const [sessionId, count] of left) {
    if (right.get(sessionId) !== count) return false;
  }
  return true;
}

/** Add one unread Guest message without mutating the current React state. */
export function incrementUnreadConversation(
  current: UnreadConversationCounts,
  sessionId: string,
): UnreadConversationCounts {
  const next = new Map(current);
  next.set(sessionId, (next.get(sessionId) ?? 0) + 1);
  return next;
}

/** Opening a conversation marks every message in that room as read. */
export function clearUnreadConversation(
  current: UnreadConversationCounts,
  sessionId: string,
): UnreadConversationCounts {
  if (!current.has(sessionId)) return current;
  const next = new Map(current);
  next.delete(sessionId);
  return next;
}

/**
 * Remove rooms that are no longer open and mark newly arrived waiting rooms.
 * Returning the original Map when nothing changed avoids a render every poll.
 */
export function reconcileUnreadConversations(
  current: UnreadConversationCounts,
  openSessionIds: ReadonlySet<string>,
  newlyUnreadSessionIds: readonly string[],
): UnreadConversationCounts {
  const next = new Map<string, number>();
  for (const [sessionId, count] of current) {
    if (openSessionIds.has(sessionId)) next.set(sessionId, count);
  }
  for (const sessionId of newlyUnreadSessionIds) {
    if (openSessionIds.has(sessionId) && !next.has(sessionId)) {
      next.set(sessionId, 1);
    }
  }
  return mapsEqual(current, next) ? current : next;
}

/** Replace local unread counts with the shared server state returned for this account. */
export function synchronizeUnreadConversations(
  current: UnreadConversationCounts,
  serverCounts: readonly { sessionId: string; count: number }[],
): UnreadConversationCounts {
  const next = new Map<string, number>();
  for (const item of serverCounts) {
    if (Number.isSafeInteger(item.count) && item.count > 0) {
      next.set(item.sessionId, item.count);
    }
  }
  return mapsEqual(current, next) ? current : next;
}

export function totalUnreadMessages(
  unread: UnreadConversationCounts,
): number {
  let total = 0;
  for (const count of unread.values()) total += count;
  return total;
}
