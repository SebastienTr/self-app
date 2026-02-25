/**
 * Unit tests for useAppStateConnection hook.
 */

import { AppState } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';

jest.mock('@/services/wsClient', () => ({
  connect: jest.fn(),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(),
  },
}));

jest.mock('@/stores/connectionStore', () => ({
  useConnectionStore: {
    getState: jest.fn(),
  },
}));

import { connect } from '@/services/wsClient';
import { useAuthStore } from '@/stores/authStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useAppStateConnection } from './useAppStateConnection';

const mockConnect = connect as jest.MockedFunction<typeof connect>;
const mockAuthGetState = useAuthStore.getState as jest.MockedFunction<typeof useAuthStore.getState>;
const mockConnectionGetState = useConnectionStore.getState as jest.MockedFunction<typeof useConnectionStore.getState>;

type AppStateHandler = (state: 'active' | 'background' | 'inactive') => void;
let appStateHandler: AppStateHandler | null = null;
const mockRemove = jest.fn();

beforeEach(() => {
  appStateHandler = null;
  mockRemove.mockClear();
  mockConnect.mockClear();

  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'active',
  });

  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler: any) => {
    if (event === 'change') {
      appStateHandler = handler;
    }
    return { remove: mockRemove } as any;
  });

  mockAuthGetState.mockReturnValue({
    sessionToken: 'token-1',
    backendUrl: 'ws://localhost:8000/ws',
  } as any);
  mockConnectionGetState.mockReturnValue({
    status: 'disconnected',
  } as any);

  jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
});

afterEach(() => {
  jest.restoreAllMocks();
});

function emit(state: 'active' | 'background' | 'inactive') {
  if (!appStateHandler) throw new Error('AppState handler not registered');
  act(() => {
    appStateHandler!(state);
  });
}

describe('useAppStateConnection', () => {
  it('registers an AppState change listener and cleans it up on unmount', () => {
    const { unmount } = renderHook(() => useAppStateConnection());

    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    unmount();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it('does not reconnect when transitioning to background', () => {
    renderHook(() => useAppStateConnection());

    emit('background');

    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('reconnects on background -> active after more than 5 seconds', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1000); // background timestamp
    nowSpy.mockReturnValueOnce(7001); // active timestamp (>5s later)

    renderHook(() => useAppStateConnection());

    emit('background');
    emit('active');

    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockConnect).toHaveBeenCalledWith('ws://localhost:8000/ws');
  });

  it('does not reconnect when returning within 5 seconds', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1000); // background timestamp
    nowSpy.mockReturnValueOnce(5800); // <5s later

    renderHook(() => useAppStateConnection());

    emit('background');
    emit('active');

    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('does not reconnect when no session token is configured', () => {
    mockAuthGetState.mockReturnValue({
      sessionToken: null,
      backendUrl: 'ws://localhost:8000/ws',
    } as any);
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1000);
    nowSpy.mockReturnValueOnce(7001);

    renderHook(() => useAppStateConnection());

    emit('background');
    emit('active');

    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('does not reconnect when already connected', () => {
    mockConnectionGetState.mockReturnValue({
      status: 'connected',
    } as any);
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1000);
    nowSpy.mockReturnValueOnce(7001);

    renderHook(() => useAppStateConnection());

    emit('background');
    emit('active');

    expect(mockConnect).not.toHaveBeenCalled();
  });
});
