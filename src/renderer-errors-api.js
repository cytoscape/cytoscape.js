/**
 * Renderer Errors Public API
 *
 * Provides a lightweight event-emitter-based API and callback helpers for exposing
 * renderer errors to application code. Includes a normalization helper to convert
 * arbitrary error inputs into a stable, documented shape.
 *
 * Error payload shape:
 * {
 *   message: string,
 *   stack?: string,
 *   code?: string|number,
 *   meta?: Record<string, any>,
 *   original?: any
 * }
 *
 * This module uses plain JavaScript (ES modules) and contains a tiny emitter shim
 * that works in both browsers and Node without external dependencies.
 *
 * @module renderer-errors-api
 */

/**
 * @typedef {Object} NormalizedRenderError
 * @property {string} message - Human-readable error message.
 * @property {string} [stack] - Stack trace if available.
 * @property {string|number} [code] - Optional code or name for the error.
 * @property {Object<string, any>} [meta] - Additional metadata related to the error.
 * @property {any} [original] - The original error value received.
 */

/**
 * Event name emitted for renderer errors.
 * @type {"render:error"}
 */
export const RENDER_ERROR_EVENT = 'render:error';

/**
 * Minimal event emitter with on/off/emit.
 * Works in browsers and Node. Avoids external dependencies.
 */
class TinyEmitter {
  constructor() {
    /** @type {Record<string, Set<Function>>} */
    this.listenersMap = Object.create(null);
  }

  /**
   * Register an event listener.
   * @param {string} eventName
   * @param {Function} handler
   */
  on(eventName, handler) {
    if (!this.listenersMap[eventName]) this.listenersMap[eventName] = new Set();
    this.listenersMap[eventName].add(handler);
  }

  /**
   * Remove an event listener.
   * @param {string} eventName
   * @param {Function} handler
   */
  off(eventName, handler) {
    const set = this.listenersMap[eventName];
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) delete this.listenersMap[eventName];
  }

  /**
   * Emit an event with a payload.
   * @param {string} eventName
   * @param {any} payload
   */
  emit(eventName, payload) {
    const set = this.listenersMap[eventName];
    if (!set || set.size === 0) return;
    // Snapshot to guard against reentrancy and handler mutations during emit
    const handlers = Array.from(set);
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (_err) {
        // Swallow handler errors to avoid cascading failures
      }
    }
  }
}

/**
 * Normalize any error-like input into a stable shape.
 *
 * @param {any} err - The error value to normalize (Error | string | object | other).
 * @returns {NormalizedRenderError}
 */
export function safeNormalizeError(err) {
  /** @type {NormalizedRenderError} */
  const base = {
    message: 'Unknown error'
  };

  if (err instanceof Error) {
    base.message = typeof err.message === 'string' && err.message.length > 0 ? err.message : String(err);
    if (typeof err.stack === 'string') base.stack = err.stack;
    if (err && typeof err === 'object' && 'code' in err && (typeof err.code === 'string' || typeof err.code === 'number')) {
      base.code = err.code;
    }
    if (err && typeof err === 'object' && 'meta' in err && err.meta && typeof err.meta === 'object') {
      base.meta = { ...err.meta };
    }
    base.original = err;
    return base;
  }

  const t = typeof err;
  if (t === 'string') {
    base.message = /** @type {string} */ (err);
    base.original = err;
    return base;
  }

  if (err && t === 'object') {
    // err is a plain object or non-Error object
    const obj = /** @type {Record<string, any>} */ (err);
    if (typeof obj.message === 'string' && obj.message.length > 0) {
      base.message = obj.message;
    } else {
      // Fallback to toString for non-string or missing message
      try {
        base.message = String(err);
      } catch (_) {
        base.message = 'Unknown error';
      }
    }
    if (typeof obj.stack === 'string') base.stack = obj.stack;
    if (typeof obj.code === 'string' || typeof obj.code === 'number') base.code = obj.code;
    // Prefer explicit meta if present; otherwise collect remaining enumerable props as meta
    if (obj.meta && typeof obj.meta === 'object') {
      base.meta = { ...obj.meta };
    } else {
      const { message, stack, code, ...rest } = obj;
      const keys = Object.keys(rest);
      if (keys.length > 0) base.meta = { ...rest };
    }
    base.original = err;
    return base;
  }

  // numbers, booleans, symbols, undefined, null
  try {
    base.message = String(err);
  } catch (_) {
    base.message = 'Unknown error';
  }
  base.original = err;
  return base;
}

/**
 * Create a renderer errors API instance. Intended to be composed into a renderer
 * implementation that catches internal render failures. The renderer should call
 * `emitRenderError(err)` whenever a render error occurs.
 *
 * @returns {{
 *   on: (eventName: string, handler: (payload: NormalizedRenderError) => void) => void,
 *   off: (eventName: string, handler: (payload: NormalizedRenderError) => void) => void,
 *   onRenderError: (handler: (payload: NormalizedRenderError) => void) => void,
 *   offRenderError: (handler: (payload: NormalizedRenderError) => void) => void,
 *   getLastRenderError: () => (NormalizedRenderError | null),
 *   emitRenderError: (err: any) => NormalizedRenderError
 * }}
 */
export function createRendererErrorsAPI() {
  const emitter = new TinyEmitter();
  /** @type {Set<(payload: NormalizedRenderError) => void>} */
  const callbacks = new Set();
  /** @type {NormalizedRenderError | null} */
  let lastError = null;

  function on(eventName, handler) {
    emitter.on(eventName, handler);
  }

  function off(eventName, handler) {
    emitter.off(eventName, handler);
  }

  function onRenderError(handler) {
    callbacks.add(handler);
  }

  function offRenderError(handler) {
    callbacks.delete(handler);
  }

  function getLastRenderError() {
    return lastError;
  }

  function emitRenderError(err) {
    const normalized = safeNormalizeError(err);
    lastError = normalized;

    // Emit via event emitter
    emitter.emit(RENDER_ERROR_EVENT, normalized);

    // Snapshot callbacks to handle reentrancy / removals during iteration
    const list = Array.from(callbacks);
    for (const cb of list) {
      try {
        cb(normalized);
      } catch (_err) {
        // Swallow handler errors to avoid cascading failures
      }
    }
    return normalized;
  }

  return {
    on,
    off,
    onRenderError,
    offRenderError,
    getLastRenderError,
    emitRenderError
  };
}

export default createRendererErrorsAPI;


