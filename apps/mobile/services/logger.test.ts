/**
 * Tests for the structured logging service.
 *
 * Covers: log(), logger convenience methods, log queue management,
 * registerLogSender/unregisterLogSender, severity routing, timestamp format,
 * layer prefixing, and agent_action defaults.
 */

// Suppress console output during tests
const consoleSpy = {
  log: jest.spyOn(console, 'log').mockImplementation(() => {}),
  error: jest.spyOn(console, 'error').mockImplementation(() => {}),
};

import {
  log,
  logger,
  registerLogSender,
  unregisterLogSender,
  getLogQueueLength,
  clearLogQueue,
} from './logger';
import type { LogEntry, Severity } from './logger';

beforeEach(() => {
  consoleSpy.log.mockClear();
  consoleSpy.error.mockClear();
  unregisterLogSender();
  clearLogQueue();
});

describe('logger', () => {
  describe('log()', () => {
    it('outputs a structured JSON entry to console.log for info severity', () => {
      log('ws', 'connected', { url: 'ws://localhost' });

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const entry: LogEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(entry.layer).toBe('mobile:ws');
      expect(entry.event).toBe('connected');
      expect(entry.severity).toBe('info');
      expect(entry.context.url).toBe('ws://localhost');
    });

    it('outputs to console.error for error severity', () => {
      log('ws', 'connection_error', { reason: 'timeout' }, 'error');

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      expect(consoleSpy.log).not.toHaveBeenCalled();
      const entry: LogEntry = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(entry.severity).toBe('error');
    });

    it('outputs to console.log for debug severity', () => {
      log('ws', 'message_sent', {}, 'debug');
      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const entry: LogEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(entry.severity).toBe('debug');
    });

    it('outputs to console.log for warning severity', () => {
      log('ws', 'slow_response', {}, 'warning');
      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const entry: LogEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(entry.severity).toBe('warning');
    });

    it('defaults severity to info when not provided', () => {
      log('store', 'state_change', {});
      const entry: LogEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(entry.severity).toBe('info');
    });

    it('defaults context to empty object when not provided', () => {
      log('ws', 'heartbeat');
      const entry: LogEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(entry.context).toEqual({ agent_action: null });
    });

    it('prefixes layer with "mobile:"', () => {
      log('auth', 'token_refreshed', {});
      const entry: LogEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(entry.layer).toBe('mobile:auth');
    });

    it('produces a valid ISO 8601 timestamp', () => {
      log('ws', 'test_event', {});
      const entry: LogEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      const parsed = new Date(entry.ts);
      expect(parsed.toISOString()).toBe(entry.ts);
    });

    it('sets agent_action to null when not provided in context', () => {
      log('ws', 'event', { key: 'value' });
      const entry: LogEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(entry.context.agent_action).toBeNull();
      expect(entry.context.key).toBe('value');
    });

    it('preserves agent_action when provided in context', () => {
      log('ws', 'event', { agent_action: 'Check backend logs' });
      const entry: LogEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(entry.context.agent_action).toBe('Check backend logs');
    });

    it('includes all context properties in the entry', () => {
      const ctx = { url: 'ws://test', attempt: 3, code: 1006 };
      log('ws', 'reconnect', ctx);
      const entry: LogEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(entry.context.url).toBe('ws://test');
      expect(entry.context.attempt).toBe(3);
      expect(entry.context.code).toBe(1006);
    });
  });

  describe('log queue', () => {
    it('queues entries when no sender is registered', () => {
      log('ws', 'event1', {});
      log('ws', 'event2', {});
      expect(getLogQueueLength()).toBe(2);
    });

    it('sends entries immediately when sender is registered', () => {
      const sent: LogEntry[] = [];
      registerLogSender((entry) => sent.push(entry));

      log('ws', 'event', {});
      expect(sent).toHaveLength(1);
      expect(getLogQueueLength()).toBe(0);
    });

    it('flushes queued entries when sender is registered', () => {
      log('ws', 'queued1', {});
      log('ws', 'queued2', {});
      log('ws', 'queued3', {});
      expect(getLogQueueLength()).toBe(3);

      const sent: LogEntry[] = [];
      registerLogSender((entry) => sent.push(entry));

      expect(sent).toHaveLength(3);
      expect(sent[0].event).toBe('queued1');
      expect(sent[1].event).toBe('queued2');
      expect(sent[2].event).toBe('queued3');
      expect(getLogQueueLength()).toBe(0);
    });

    it('flushes queued entries in FIFO order', () => {
      for (let i = 0; i < 5; i++) {
        log('ws', `event_${i}`, {});
      }

      const sent: LogEntry[] = [];
      registerLogSender((entry) => sent.push(entry));

      for (let i = 0; i < 5; i++) {
        expect(sent[i].event).toBe(`event_${i}`);
      }
    });

    it('queues entries again after unregistering sender', () => {
      const sent: LogEntry[] = [];
      registerLogSender((entry) => sent.push(entry));

      log('ws', 'sent_immediately', {});
      expect(sent).toHaveLength(1);

      unregisterLogSender();

      log('ws', 'queued_again', {});
      expect(sent).toHaveLength(1); // not sent
      expect(getLogQueueLength()).toBe(1);
    });

    it('clearLogQueue empties the queue', () => {
      log('ws', 'event1', {});
      log('ws', 'event2', {});
      expect(getLogQueueLength()).toBe(2);

      clearLogQueue();
      expect(getLogQueueLength()).toBe(0);
    });

    it('getLogQueueLength returns 0 initially', () => {
      expect(getLogQueueLength()).toBe(0);
    });

    it('re-registering a new sender flushes to the new callback', () => {
      log('ws', 'early', {});

      const sent1: LogEntry[] = [];
      registerLogSender((entry) => sent1.push(entry));
      expect(sent1).toHaveLength(1);

      unregisterLogSender();
      log('ws', 'between', {});

      const sent2: LogEntry[] = [];
      registerLogSender((entry) => sent2.push(entry));
      expect(sent2).toHaveLength(1);
      expect(sent2[0].event).toBe('between');
    });
  });

  describe('logger convenience methods', () => {
    it('logger.debug() logs with debug severity', () => {
      logger.debug('ws', 'debug_event', { detail: 'x' });
      const entry: LogEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(entry.severity).toBe('debug');
      expect(entry.event).toBe('debug_event');
    });

    it('logger.info() logs with info severity', () => {
      logger.info('ws', 'info_event');
      const entry: LogEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(entry.severity).toBe('info');
    });

    it('logger.warning() logs with warning severity', () => {
      logger.warning('ws', 'warn_event');
      const entry: LogEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(entry.severity).toBe('warning');
    });

    it('logger.error() logs with error severity', () => {
      logger.error('ws', 'error_event');
      const entry: LogEntry = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(entry.severity).toBe('error');
    });

    it('logger.log() works the same as the standalone log()', () => {
      logger.log('ws', 'test', { key: 'val' }, 'info');
      const entry: LogEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(entry.layer).toBe('mobile:ws');
      expect(entry.context.key).toBe('val');
    });

    it('convenience methods work without context parameter', () => {
      logger.debug('ws', 'no_ctx');
      logger.info('ws', 'no_ctx');
      logger.warning('ws', 'no_ctx');
      logger.error('ws', 'no_ctx');

      expect(consoleSpy.log).toHaveBeenCalledTimes(3);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('logger singleton properties', () => {
    it('exposes registerLogSender', () => {
      expect(typeof logger.registerLogSender).toBe('function');
    });

    it('exposes unregisterLogSender', () => {
      expect(typeof logger.unregisterLogSender).toBe('function');
    });

    it('exposes getLogQueueLength', () => {
      expect(typeof logger.getLogQueueLength).toBe('function');
    });

    it('exposes clearLogQueue', () => {
      expect(typeof logger.clearLogQueue).toBe('function');
    });
  });

  describe('edge cases', () => {
    it('handles empty string layer', () => {
      log('', 'event', {});
      const entry: LogEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(entry.layer).toBe('mobile:');
    });

    it('handles empty string event', () => {
      log('ws', '', {});
      const entry: LogEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(entry.event).toBe('');
    });

    it('handles context with nested objects', () => {
      log('ws', 'event', { nested: { deep: { value: 42 } } });
      const entry: LogEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect((entry.context.nested as any).deep.value).toBe(42);
    });

    it('handles context with array values', () => {
      log('ws', 'event', { tags: ['a', 'b', 'c'] });
      const entry: LogEntry = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(entry.context.tags).toEqual(['a', 'b', 'c']);
    });

    it('handles rapid sequential logging', () => {
      for (let i = 0; i < 100; i++) {
        log('ws', `event_${i}`, {});
      }
      expect(consoleSpy.log).toHaveBeenCalledTimes(100);
      expect(getLogQueueLength()).toBe(100);
    });

    it('queues and flushes correctly with many entries', () => {
      for (let i = 0; i < 50; i++) {
        log('ws', `event_${i}`, {});
      }

      const sent: LogEntry[] = [];
      registerLogSender((entry) => sent.push(entry));

      expect(sent).toHaveLength(50);
      expect(getLogQueueLength()).toBe(0);

      // Subsequent logs go through immediately
      log('ws', 'after_flush', {});
      expect(sent).toHaveLength(51);
    });
  });
});
