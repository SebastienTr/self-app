/**
 * Token stream buffer — batches frequent chat deltas to one update per frame.
 *
 * Designed for chat_stream bursts (~30-50 tokens/sec) to reduce Zustand writes.
 * chatSync registers the sink via setStreamBufferSink().
 */

type FlushSink = (delta: string) => void;

let sink: FlushSink = () => {};
let pendingDelta = '';
let scheduledFrame: number | ReturnType<typeof setTimeout> | null = null;

function requestFrame(cb: () => void): number | ReturnType<typeof setTimeout> {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return globalThis.requestAnimationFrame(() => cb());
  }
  return setTimeout(cb, 16);
}

function cancelFrame(handle: number | ReturnType<typeof setTimeout>): void {
  if (typeof globalThis.cancelAnimationFrame === 'function' && typeof handle === 'number') {
    globalThis.cancelAnimationFrame(handle);
    return;
  }
  clearTimeout(handle as ReturnType<typeof setTimeout>);
}

function flushPending(): void {
  scheduledFrame = null;
  if (!pendingDelta) return;
  const delta = pendingDelta;
  pendingDelta = '';
  sink(delta);
}

export function setStreamBufferSink(nextSink: FlushSink): void {
  sink = nextSink;
}

export function bufferToken(delta: string): void {
  pendingDelta += delta;
  if (scheduledFrame !== null) return;
  scheduledFrame = requestFrame(flushPending);
}

export function flushImmediately(): void {
  if (scheduledFrame !== null) {
    cancelFrame(scheduledFrame);
    scheduledFrame = null;
  }
  flushPending();
}

export function resetStreamBuffer(): void {
  if (scheduledFrame !== null) {
    cancelFrame(scheduledFrame);
    scheduledFrame = null;
  }
  pendingDelta = '';
  sink = () => {};
}
