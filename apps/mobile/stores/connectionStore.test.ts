import { useConnectionStore } from './connectionStore';
import type { ConnectionStatus, PersonaType } from '@/types/ws';

describe('connectionStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useConnectionStore.setState({
      status: 'disconnected',
      reconnectAttempts: 0,
      lastSync: null,
      lastSeq: 0,
      backendUrl: 'ws://localhost:8000/ws',
      persona: null,
    });
  });

  describe('initial state', () => {
    it('has correct default values', () => {
      const state = useConnectionStore.getState();
      expect(state.status).toBe('disconnected');
      expect(state.reconnectAttempts).toBe(0);
      expect(state.lastSync).toBeNull();
      expect(state.lastSeq).toBe(0);
      expect(state.backendUrl).toBe('ws://localhost:8000/ws');
    });
  });

  describe('actions', () => {
    it('setStatus updates connection status', () => {
      const { setStatus } = useConnectionStore.getState();
      setStatus('connecting');
      expect(useConnectionStore.getState().status).toBe('connecting');
    });

    it('setStatus cycles through all valid statuses', () => {
      const { setStatus } = useConnectionStore.getState();
      const statuses: ConnectionStatus[] = [
        'disconnected',
        'connecting',
        'connected',
        'reconnecting',
      ];
      for (const s of statuses) {
        setStatus(s);
        expect(useConnectionStore.getState().status).toBe(s);
      }
    });

    it('setBackendUrl updates the URL', () => {
      const { setBackendUrl } = useConnectionStore.getState();
      setBackendUrl('ws://192.168.1.100:8000/ws');
      expect(useConnectionStore.getState().backendUrl).toBe(
        'ws://192.168.1.100:8000/ws',
      );
    });

    it('incrementReconnectAttempts increments by 1', () => {
      const { incrementReconnectAttempts } = useConnectionStore.getState();
      incrementReconnectAttempts();
      expect(useConnectionStore.getState().reconnectAttempts).toBe(1);
      incrementReconnectAttempts();
      expect(useConnectionStore.getState().reconnectAttempts).toBe(2);
    });

    it('resetReconnectAttempts resets to 0', () => {
      const { incrementReconnectAttempts, resetReconnectAttempts } =
        useConnectionStore.getState();
      incrementReconnectAttempts();
      incrementReconnectAttempts();
      incrementReconnectAttempts();
      expect(useConnectionStore.getState().reconnectAttempts).toBe(3);
      resetReconnectAttempts();
      expect(useConnectionStore.getState().reconnectAttempts).toBe(0);
    });

    it('setLastSync updates the timestamp', () => {
      const { setLastSync } = useConnectionStore.getState();
      const ts = '2024-01-15T10:30:00Z';
      setLastSync(ts);
      expect(useConnectionStore.getState().lastSync).toBe(ts);
    });

    it('setLastSeq updates the sequence number', () => {
      const { setLastSeq } = useConnectionStore.getState();
      setLastSeq(123);
      expect(useConnectionStore.getState().lastSeq).toBe(123);
    });
  });

  describe('selectors', () => {
    it('getIsConnected returns true when connected', () => {
      const { setStatus } = useConnectionStore.getState();
      setStatus('connected');
      expect(useConnectionStore.getState().getIsConnected()).toBe(true);
    });

    it('getIsConnected returns false when not connected', () => {
      const { setStatus } = useConnectionStore.getState();
      const notConnected: ConnectionStatus[] = [
        'disconnected',
        'connecting',
        'reconnecting',
      ];
      for (const s of notConnected) {
        setStatus(s);
        expect(useConnectionStore.getState().getIsConnected()).toBe(false);
      }
    });

    it('getStatus returns current status', () => {
      const { setStatus } = useConnectionStore.getState();
      setStatus('reconnecting');
      expect(useConnectionStore.getState().getStatus()).toBe('reconnecting');
    });
  });

  // --- Additional edge case tests ---

  describe('edge cases', () => {
    it('rapid status transitions maintain correct final state', () => {
      const { setStatus } = useConnectionStore.getState();
      setStatus('connecting');
      setStatus('connected');
      setStatus('reconnecting');
      setStatus('connecting');
      setStatus('connected');
      expect(useConnectionStore.getState().status).toBe('connected');
      expect(useConnectionStore.getState().getIsConnected()).toBe(true);
    });

    it('multiple increments produce correct count', () => {
      const { incrementReconnectAttempts } = useConnectionStore.getState();
      for (let i = 0; i < 20; i++) {
        incrementReconnectAttempts();
      }
      expect(useConnectionStore.getState().reconnectAttempts).toBe(20);
    });

    it('increment then reset then increment again works correctly', () => {
      const state = useConnectionStore.getState();
      state.incrementReconnectAttempts();
      state.incrementReconnectAttempts();
      state.incrementReconnectAttempts();
      expect(useConnectionStore.getState().reconnectAttempts).toBe(3);

      state.resetReconnectAttempts();
      expect(useConnectionStore.getState().reconnectAttempts).toBe(0);

      state.incrementReconnectAttempts();
      expect(useConnectionStore.getState().reconnectAttempts).toBe(1);
    });

    it('setLastSync with different timestamp values', () => {
      const { setLastSync } = useConnectionStore.getState();
      setLastSync('2024-01-01T00:00:00Z');
      expect(useConnectionStore.getState().lastSync).toBe('2024-01-01T00:00:00Z');

      setLastSync('2024-06-15T12:30:45Z');
      expect(useConnectionStore.getState().lastSync).toBe('2024-06-15T12:30:45Z');

      setLastSync('2024-12-31T23:59:59Z');
      expect(useConnectionStore.getState().lastSync).toBe('2024-12-31T23:59:59Z');
    });

    it('setBackendUrl accepts various URL formats', () => {
      const { setBackendUrl } = useConnectionStore.getState();

      setBackendUrl('ws://192.168.1.100:8000/ws');
      expect(useConnectionStore.getState().backendUrl).toBe('ws://192.168.1.100:8000/ws');

      setBackendUrl('wss://api.example.com/ws');
      expect(useConnectionStore.getState().backendUrl).toBe('wss://api.example.com/ws');

      setBackendUrl('ws://10.0.0.1:3000/ws');
      expect(useConnectionStore.getState().backendUrl).toBe('ws://10.0.0.1:3000/ws');
    });

    it('store subscription notifies on state changes', () => {
      const statusChanges: ConnectionStatus[] = [];
      const unsubscribe = useConnectionStore.subscribe((state) => {
        statusChanges.push(state.status);
      });

      useConnectionStore.getState().setStatus('connecting');
      useConnectionStore.getState().setStatus('connected');

      expect(statusChanges).toContain('connecting');
      expect(statusChanges).toContain('connected');

      unsubscribe();
    });

    it('getIsConnected and getStatus remain accurate after multiple mutations', () => {
      const state = useConnectionStore.getState();

      state.setStatus('connecting');
      expect(useConnectionStore.getState().getIsConnected()).toBe(false);
      expect(useConnectionStore.getState().getStatus()).toBe('connecting');

      state.setStatus('connected');
      expect(useConnectionStore.getState().getIsConnected()).toBe(true);
      expect(useConnectionStore.getState().getStatus()).toBe('connected');

      state.setStatus('reconnecting');
      expect(useConnectionStore.getState().getIsConnected()).toBe(false);
      expect(useConnectionStore.getState().getStatus()).toBe('reconnecting');

      state.setStatus('disconnected');
      expect(useConnectionStore.getState().getIsConnected()).toBe(false);
      expect(useConnectionStore.getState().getStatus()).toBe('disconnected');
    });

    it('state changes are independent (changing one does not affect others)', () => {
      const state = useConnectionStore.getState();

      state.setStatus('connected');
      state.incrementReconnectAttempts();
      state.setLastSync('2024-01-01');
      state.setLastSeq(9);
      state.setBackendUrl('ws://other:8000/ws');

      const current = useConnectionStore.getState();
      expect(current.status).toBe('connected');
      expect(current.reconnectAttempts).toBe(1);
      expect(current.lastSync).toBe('2024-01-01');
      expect(current.lastSeq).toBe(9);
      expect(current.backendUrl).toBe('ws://other:8000/ws');
    });

    it('resetting reconnect attempts does not affect other state', () => {
      const state = useConnectionStore.getState();
      state.setStatus('reconnecting');
      state.incrementReconnectAttempts();
      state.incrementReconnectAttempts();
      state.setLastSync('2024-06-01');
      state.setLastSeq(12);

      state.resetReconnectAttempts();

      const current = useConnectionStore.getState();
      expect(current.reconnectAttempts).toBe(0);
      expect(current.status).toBe('reconnecting'); // unchanged
      expect(current.lastSync).toBe('2024-06-01'); // unchanged
      expect(current.lastSeq).toBe(12); // unchanged
    });
  });

  describe('persona (Story 2.3)', () => {
    it('has null persona by default', () => {
      const state = useConnectionStore.getState();
      expect(state.persona).toBeNull();
    });

    it('setPersona updates persona to flame', () => {
      useConnectionStore.getState().setPersona('flame');
      expect(useConnectionStore.getState().persona).toBe('flame');
    });

    it('setPersona updates persona to tree', () => {
      useConnectionStore.getState().setPersona('tree');
      expect(useConnectionStore.getState().persona).toBe('tree');
    });

    it('setPersona updates persona to star', () => {
      useConnectionStore.getState().setPersona('star');
      expect(useConnectionStore.getState().persona).toBe('star');
    });

    it('setPersona can set back to null', () => {
      useConnectionStore.getState().setPersona('flame');
      expect(useConnectionStore.getState().persona).toBe('flame');
      useConnectionStore.getState().setPersona(null);
      expect(useConnectionStore.getState().persona).toBeNull();
    });

    it('setPersona cycles through all valid personas', () => {
      const personas: PersonaType[] = ['flame', 'tree', 'star'];
      for (const p of personas) {
        useConnectionStore.getState().setPersona(p);
        expect(useConnectionStore.getState().persona).toBe(p);
      }
    });

    it('setPersona does not affect other state', () => {
      const state = useConnectionStore.getState();
      state.setStatus('connected');
      state.setLastSync('2024-01-01');
      state.setLastSeq(5);
      state.setPersona('flame');

      const current = useConnectionStore.getState();
      expect(current.persona).toBe('flame');
      expect(current.status).toBe('connected');
      expect(current.lastSync).toBe('2024-01-01');
      expect(current.lastSeq).toBe(5);
    });
  });
});
