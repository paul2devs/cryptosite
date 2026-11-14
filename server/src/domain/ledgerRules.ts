export function buildLedgerIdempotencyKey(
  sourceType: string,
  sourceId: string,
  accountCode: string
): string {
  return `${sourceType}:${sourceId}:${accountCode}`;
}
