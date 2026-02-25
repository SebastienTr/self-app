/**
 * Edge case tests for connectionStore persona behavior (Story 2.3).
 *
 * Tests boundary conditions not covered by connectionStore.test.ts:
 *   - Persona state independence from connection status
 *   - Rapid persona switching
 *   - Store subscription for persona changes
 *   - Persona persistence across connection status changes
 */

import { useConnectionStore } from './connectionStore';
import type { PersonaType } from '@/types/ws';

describe('connectionStore persona edge cases', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      status: 'disconnected',
      reconnectAttempts: 0,
      lastSync: null,
      backendUrl: 'ws://localhost:8000/ws',
      persona: null,
    });
  });

  describe('persona independence from connection state', () => {
    it('persona survives connection status cycling', () => {
      const state = useConnectionStore.getState();
      state.setPersona('flame');

      state.setStatus('connecting');
      expect(useConnectionStore.getState().persona).toBe('flame');

      state.setStatus('connected');
      expect(useConnectionStore.getState().persona).toBe('flame');

      state.setStatus('reconnecting');
      expect(useConnectionStore.getState().persona).toBe('flame');

      state.setStatus('disconnected');
      expect(useConnectionStore.getState().persona).toBe('flame');
    });

    it('persona survives reconnect attempts reset', () => {
      const state = useConnectionStore.getState();
      state.setPersona('tree');
      state.incrementReconnectAttempts();
      state.incrementReconnectAttempts();
      state.resetReconnectAttempts();

      expect(useConnectionStore.getState().persona).toBe('tree');
    });

    it('persona survives lastSync update', () => {
      const state = useConnectionStore.getState();
      state.setPersona('star');
      state.setLastSync('2026-02-25T10:00:00Z');

      expect(useConnectionStore.getState().persona).toBe('star');
    });

    it('persona survives backendUrl change', () => {
      const state = useConnectionStore.getState();
      state.setPersona('flame');
      state.setBackendUrl('ws://192.168.1.100:8000/ws');

      expect(useConnectionStore.getState().persona).toBe('flame');
    });
  });

  describe('rapid persona switching', () => {
    it('handles 20 rapid persona changes', () => {
      const state = useConnectionStore.getState();
      const personas: PersonaType[] = ['flame', 'tree', 'star'];

      for (let i = 0; i < 20; i++) {
        state.setPersona(personas[i % 3]);
      }

      // Last iteration: i=19, 19 % 3 = 1 -> tree (index 1)
      expect(useConnectionStore.getState().persona).toBe('tree');
    });

    it('handles alternating persona and null', () => {
      const state = useConnectionStore.getState();

      state.setPersona('flame');
      expect(useConnectionStore.getState().persona).toBe('flame');

      state.setPersona(null);
      expect(useConnectionStore.getState().persona).toBeNull();

      state.setPersona('tree');
      expect(useConnectionStore.getState().persona).toBe('tree');

      state.setPersona(null);
      expect(useConnectionStore.getState().persona).toBeNull();

      state.setPersona('star');
      expect(useConnectionStore.getState().persona).toBe('star');
    });
  });

  describe('store subscription for persona', () => {
    it('subscription fires on persona change', () => {
      const personaChanges: (PersonaType | null)[] = [];
      const unsubscribe = useConnectionStore.subscribe((state) => {
        personaChanges.push(state.persona);
      });

      useConnectionStore.getState().setPersona('flame');
      useConnectionStore.getState().setPersona('tree');
      useConnectionStore.getState().setPersona(null);

      expect(personaChanges).toEqual(['flame', 'tree', null]);

      unsubscribe();
    });

    it('subscription for persona does not fire on unrelated changes', () => {
      let personaNotifyCount = 0;
      const unsubscribe = useConnectionStore.subscribe(
        (state) => state.persona,
        () => {
          personaNotifyCount++;
        },
      );

      // These should NOT trigger persona-specific subscription
      useConnectionStore.getState().setStatus('connecting');
      useConnectionStore.getState().incrementReconnectAttempts();
      useConnectionStore.getState().setLastSync('2026-01-01');

      expect(personaNotifyCount).toBe(0);

      unsubscribe();
    });
  });

  describe('full state reset including persona', () => {
    it('setState resets persona to null', () => {
      useConnectionStore.getState().setPersona('flame');
      expect(useConnectionStore.getState().persona).toBe('flame');

      useConnectionStore.setState({ persona: null });
      expect(useConnectionStore.getState().persona).toBeNull();
    });

    it('setState with full reset clears persona', () => {
      useConnectionStore.getState().setPersona('tree');
      useConnectionStore.getState().setStatus('connected');

      useConnectionStore.setState({
        status: 'disconnected',
        reconnectAttempts: 0,
        lastSync: null,
        backendUrl: 'ws://localhost:8000/ws',
        persona: null,
      });

      const state = useConnectionStore.getState();
      expect(state.persona).toBeNull();
      expect(state.status).toBe('disconnected');
    });
  });
});
