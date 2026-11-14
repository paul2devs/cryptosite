"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLedgerIdempotencyKey = buildLedgerIdempotencyKey;
function buildLedgerIdempotencyKey(sourceType, sourceId, accountCode) {
    return `${sourceType}:${sourceId}:${accountCode}`;
}
