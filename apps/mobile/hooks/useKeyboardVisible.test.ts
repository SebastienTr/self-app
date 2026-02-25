/**
 * Unit tests for useKeyboardVisible hook.
 *
 * Tests:
 *   - Returns { keyboardVisible: false } initially
 *   - keyboardVisible becomes true on show events (platform-aware)
 *   - keyboardVisible becomes false on hide events (platform-aware)
 *   - Cleans up listeners on unmount
 *   - No store dependencies (pure hook)
 */

import { Keyboard, Platform } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';

import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';

type KeyboardHandler = (e?: any) => void;
const listeners = new Map<string, KeyboardHandler[]>();

const mockRemove = jest.fn();

beforeEach(() => {
  listeners.clear();
  mockRemove.mockClear();
  jest.spyOn(Keyboard, 'addListener').mockImplementation((event: string, handler: KeyboardHandler | any) => {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event)!.push(handler);
    return { remove: mockRemove } as any;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const MOCK_KEYBOARD_HEIGHT = 300;
function fireKeyboardEvent(event: string) {
  const handlers = listeners.get(event) || [];
  const isShowEvent = event.includes('Show');
  const arg = isShowEvent ? { endCoordinates: { height: MOCK_KEYBOARD_HEIGHT } } : undefined;
  for (const handler of handlers) handler(arg);
}

describe('useKeyboardVisible', () => {
  it('returns keyboardVisible false and keyboardHeight 0 initially', () => {
    const { result } = renderHook(() => useKeyboardVisible());
    expect(result.current.keyboardVisible).toBe(false);
    expect(result.current.keyboardHeight).toBe(0);
  });

  describe('iOS (default test platform)', () => {
    it('sets keyboardVisible to true and keyboardHeight on keyboardWillShow', () => {
      const { result } = renderHook(() => useKeyboardVisible());
      act(() => { fireKeyboardEvent('keyboardWillShow'); });
      expect(result.current.keyboardVisible).toBe(true);
      expect(result.current.keyboardHeight).toBe(MOCK_KEYBOARD_HEIGHT);
    });

    it('resets keyboardVisible and keyboardHeight on keyboardWillHide', () => {
      const { result } = renderHook(() => useKeyboardVisible());
      act(() => { fireKeyboardEvent('keyboardWillShow'); });
      expect(result.current.keyboardVisible).toBe(true);
      act(() => { fireKeyboardEvent('keyboardWillHide'); });
      expect(result.current.keyboardVisible).toBe(false);
      expect(result.current.keyboardHeight).toBe(0);
    });

    it('registers keyboardWillShow and keyboardWillHide listeners', () => {
      renderHook(() => useKeyboardVisible());
      expect(listeners.has('keyboardWillShow')).toBe(true);
      expect(listeners.has('keyboardWillHide')).toBe(true);
    });
  });

  describe('Android platform', () => {
    const originalPlatform = Platform.OS;

    beforeEach(() => {
      (Platform as any).OS = 'android';
    });

    afterEach(() => {
      (Platform as any).OS = originalPlatform;
    });

    it('sets keyboardVisible to true and keyboardHeight on keyboardDidShow', () => {
      const { result } = renderHook(() => useKeyboardVisible());
      act(() => { fireKeyboardEvent('keyboardDidShow'); });
      expect(result.current.keyboardVisible).toBe(true);
      expect(result.current.keyboardHeight).toBe(MOCK_KEYBOARD_HEIGHT);
    });

    it('resets keyboardVisible and keyboardHeight on keyboardDidHide', () => {
      const { result } = renderHook(() => useKeyboardVisible());
      act(() => { fireKeyboardEvent('keyboardDidShow'); });
      expect(result.current.keyboardVisible).toBe(true);
      act(() => { fireKeyboardEvent('keyboardDidHide'); });
      expect(result.current.keyboardVisible).toBe(false);
      expect(result.current.keyboardHeight).toBe(0);
    });

    it('registers keyboardDidShow and keyboardDidHide listeners', () => {
      renderHook(() => useKeyboardVisible());
      expect(listeners.has('keyboardDidShow')).toBe(true);
      expect(listeners.has('keyboardDidHide')).toBe(true);
    });
  });

  it('cleans up listeners on unmount', () => {
    const { unmount } = renderHook(() => useKeyboardVisible());
    unmount();
    expect(mockRemove).toHaveBeenCalledTimes(2);
  });

  it('has no store dependencies (pure hook)', () => {
    // Verify module exports only the expected hook — no store re-exports
    const mod = require('@/hooks/useKeyboardVisible');
    expect(mod.useKeyboardVisible).toBeDefined();
    expect(Object.keys(mod)).toEqual(['useKeyboardVisible']);
  });
});
