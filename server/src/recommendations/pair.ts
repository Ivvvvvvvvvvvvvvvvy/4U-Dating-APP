function assertUserId(userId: string, name: string): void {
  if (typeof userId !== 'string' || userId.length === 0 || userId.trim() !== userId) {
    throw new TypeError(`${name} must be a non-empty, trimmed string`);
  }
}

export function canonicalizeUserIds(
  leftUserId: string,
  rightUserId: string,
): readonly [string, string] {
  assertUserId(leftUserId, 'leftUserId');
  assertUserId(rightUserId, 'rightUserId');

  return leftUserId.localeCompare(rightUserId, 'en') <= 0
    ? [leftUserId, rightUserId]
    : [rightUserId, leftUserId];
}

/** Matches the repository persistence contract for canonical recommendation pairs. */
export function canonicalPairKey(leftUserId: string, rightUserId: string): string {
  const [first, second] = canonicalizeUserIds(leftUserId, rightUserId);
  return `${first.length}:${first}|${second.length}:${second}`;
}
