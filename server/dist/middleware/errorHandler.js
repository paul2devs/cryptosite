"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.correlationIdMiddleware = correlationIdMiddleware;
exports.categorizeError = categorizeError;
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
exports.registerProcessHandlers = registerProcessHandlers;
exports.isSecretKey = isSecretKey;
const crypto_1 = require("crypto");
const SECRET_KEY_PATTERN = /(password|passwd|secret|token|authorization|api[_-]?key|private[_-]?key|mnemonic|seed[_-]?phrase|cookie)/i;
function correlationIdMiddleware(req, res, next) {
    const incoming = req.headers["x-correlation-id"] || req.headers["x-request-id"];
    const correlationId = typeof incoming === "string" && incoming.trim().length > 0
        ? incoming.trim().slice(0, 128)
        : (0, crypto_1.randomUUID)();
    res.locals.correlationId = correlationId;
    res.setHeader("X-Correlation-Id", correlationId);
    next();
}
function readName(error) {
    if (error && typeof error === "object" && "name" in error) {
        return String(error.name || "");
    }
    return "";
}
function readMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    if (error && typeof error === "object" && "message" in error) {
        return String(error.message);
    }
    return String(error);
}
function readStatus(error) {
    if (error && typeof error === "object") {
        const candidate = error;
        const raw = typeof candidate.status === "number"
            ? candidate.status
            : typeof candidate.statusCode === "number"
                ? candidate.statusCode
                : undefined;
        if (typeof raw === "number" && raw >= 400 && raw <= 599) {
            return raw;
        }
    }
    return undefined;
}
function readSqlState(error) {
    if (error && typeof error === "object") {
        const candidate = error;
        const code = candidate.parent?.code ?? candidate.original?.code ?? candidate.code;
        if (typeof code === "string" && code.length > 0) {
            return code;
        }
    }
    return undefined;
}
function categorizeError(error) {
    const name = readName(error);
    const diagnostic = readMessage(error);
    const code = readSqlState(error);
    const explicitStatus = readStatus(error);
    if (name === "SyntaxError" &&
        explicitStatus === 400 &&
        error !== null &&
        typeof error === "object" &&
        "body" in error) {
        return {
            status: 400,
            category: "validation",
            publicMessage: "Malformed request body.",
            diagnostic
        };
    }
    switch (name) {
        case "SequelizeValidationError":
            return {
                status: 400,
                category: "validation",
                publicMessage: "One or more fields are invalid.",
                diagnostic,
                code
            };
        case "SequelizeUniqueConstraintError":
            return {
                status: 409,
                category: "conflict",
                publicMessage: "A record with these values already exists.",
                diagnostic,
                code
            };
        case "SequelizeForeignKeyConstraintError":
            return {
                status: 409,
                category: "conflict",
                publicMessage: "This operation conflicts with existing related records.",
                diagnostic,
                code
            };
        case "SequelizeConnectionError":
        case "SequelizeConnectionRefusedError":
        case "SequelizeConnectionAcquireTimeoutError":
        case "SequelizeHostNotReachableError":
        case "SequelizeAccessDeniedError":
        case "SequelizeTimeoutError":
            return {
                status: 503,
                category: "database",
                publicMessage: "The service is temporarily unable to reach its database. Please try again shortly.",
                diagnostic,
                code
            };
        case "SequelizeDatabaseError":
            return {
                status: 500,
                category: "database",
                publicMessage: "A database operation failed.",
                diagnostic,
                code
            };
        case "JsonWebTokenError":
        case "TokenExpiredError":
        case "NotBeforeError":
            return {
                status: 401,
                category: "authentication",
                publicMessage: "Your session is invalid or has expired.",
                diagnostic,
                code
            };
    }
    if (explicitStatus === 429 || name === "RateLimitError") {
        return {
            status: 429,
            category: "rate_limit",
            publicMessage: "Too many requests. Please slow down and try again.",
            diagnostic,
            code
        };
    }
    if (explicitStatus === 404) {
        return {
            status: 404,
            category: "not_found",
            publicMessage: "The requested resource could not be found.",
            diagnostic,
            code
        };
    }
    if (explicitStatus === 401) {
        return {
            status: 401,
            category: "authentication",
            publicMessage: "Authentication is required for this request.",
            diagnostic,
            code
        };
    }
    if (explicitStatus === 403) {
        return {
            status: 403,
            category: "authorization",
            publicMessage: "You do not have permission to perform this action.",
            diagnostic,
            code
        };
    }
    if (explicitStatus === 400) {
        return {
            status: 400,
            category: "validation",
            publicMessage: "The request could not be processed.",
            diagnostic,
            code
        };
    }
    if (typeof explicitStatus === "number") {
        return {
            status: explicitStatus,
            category: explicitStatus >= 500 ? "unknown" : "validation",
            publicMessage: "The request could not be processed.",
            diagnostic,
            code
        };
    }
    return {
        status: 500,
        category: "unknown",
        publicMessage: "An unexpected error occurred. Please try again later.",
        diagnostic,
        code
    };
}
function sanitizeForLog(value) {
    let result = value;
    result = result.replace(/("(?:[^"]*(?:password|secret|token|api[_-]?key|private[_-]?key)[^"]*)"\s*:\s*)"(?:[^"\\]|\\.)*"/gi, '$1"[REDACTED]"');
    result = result.replace(/(postgres(?:ql)?:\/\/[^:\s]+):([^@\s]+)@/gi, "$1:[REDACTED]@");
    result = result.replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[REDACTED]");
    return result;
}
function errorHandler(error, req, res, next) {
    if (res.headersSent) {
        next(error);
        return;
    }
    const categorized = categorizeError(error);
    const correlationId = String(res.locals.correlationId || "");
    const path = req.originalUrl || req.path;
    const baseLog = {
        correlationId,
        method: req.method,
        path,
        status: categorized.status,
        category: categorized.category,
        code: categorized.code,
        message: sanitizeForLog(categorized.diagnostic).slice(0, 500)
    };
    if (categorized.status >= 500) {
        // eslint-disable-next-line no-console
        console.error(`[api-error] ${JSON.stringify({
            ...baseLog,
            stack: error instanceof Error && process.env.NODE_ENV !== "production"
                ? error.stack
                : undefined
        })}`);
    }
    else {
        // eslint-disable-next-line no-console
        console.warn(`[api-error] ${JSON.stringify(baseLog)}`);
    }
    const body = {
        message: categorized.publicMessage,
        correlationId,
        category: categorized.category
    };
    res.status(categorized.status).json(body);
}
function notFoundHandler(req, res, next) {
    if (res.headersSent) {
        next();
        return;
    }
    if (req.path.startsWith("/api/")) {
        res.status(404).json({
            message: "Endpoint not found",
            path: req.path,
            correlationId: String(res.locals.correlationId || "")
        });
        return;
    }
    res.status(404).json({ message: "Not found", path: req.path });
}
function registerProcessHandlers() {
    process.on("unhandledRejection", (reason) => {
        // eslint-disable-next-line no-console
        console.error(`[process] Unhandled promise rejection: ${sanitizeForLog(readMessage(reason))}`);
    });
    process.on("uncaughtException", (error) => {
        // eslint-disable-next-line no-console
        console.error(`[process] Uncaught exception: ${sanitizeForLog(error.message)}`);
        // eslint-disable-next-line no-console
        console.error(error.stack || "");
    });
}
function isSecretKey(key) {
    return SECRET_KEY_PATTERN.test(key);
}
