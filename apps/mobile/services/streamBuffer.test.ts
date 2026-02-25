/**
 * Unit tests for streamBuffer rAF batching.
 */

import {
  bufferToken,
  flushImmediately,
  resetStreamBuffer,
  setStreamBufferSink,
} from './streamBuffer';

describe('streamBuffer', () => {
  let rafCallbacks: Array<() => void>;
  let nextRafId: number;
  let activeRaf = new Set<number>();

  beforeEach(() => {
    rafCallbacks = [];
    nextRafId = 1;
    activeRaf = new Set<number>();

    (globalThis as any).requestAnimationFrame = jest.fn((cb: () => void) => {
      const id = nextRafId++;
      activeRaf.add(id);
      rafCallbacks.push(() => {
        if (!activeRaf.has(id)) return;
        activeRaf.delete(id);
        cb();
      });
      return id;
    });

    (globalThis as any).cancelAnimationFrame = jest.fn((id: number) => {
      activeRaf.delete(id);
    });
  });

  afterEach(() => {
    resetStreamBuffer();
    delete (globalThis as any).requestAnimationFrame;
    delete (globalThis as any).cancelAnimationFrame;
    jest.clearAllMocks();
  });

  function flushNextFrame() {
    const cb = rafCallbacks.shift();
    if (cb) cb();
  }

  it('batches multiple tokens into a single sink flush on one frame', () => {
    const sink = jest.fn();
    setStreamBufferSink(sink);

    bufferToken('Hel');
    bufferToken('lo');
    bufferToken('!');

    expect(sink).not.toHaveBeenCalled();
    expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(1);

    flushNextFrame();

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith('Hello!');
  });

  it('flushImmediately flushes pending tokens without waiting for a frame', () => {
    const sink = jest.fn();
    setStreamBufferSink(sink);

    bufferToken('A');
    bufferToken('B');
    flushImmediately();

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith('AB');
    expect(globalThis.cancelAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('flushImmediately is a no-op when buffer is empty', () => {
    const sink = jest.fn();
    setStreamBufferSink(sink);

    flushImmediately();

    expect(sink).not.toHaveBeenCalled();
  });

  it('schedules a new frame after a previous frame has flushed', () => {
    const sink = jest.fn();
    setStreamBufferSink(sink);

    bufferToken('one');
    flushNextFrame();
    bufferToken('two');
    flushNextFrame();

    expect(sink).toHaveBeenNthCalledWith(1, 'one');
    expect(sink).toHaveBeenNthCalledWith(2, 'two');
    expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(2);
  });
});
