/**
 * Edge case tests for PairingScreen component (Story 1-6).
 *
 * Covers:
 *   - Whitespace-only inputs (should not enable connect)
 *   - Connect button disabled during loading states
 *   - Error clears when re-attempting connection
 *   - Long URL and token values
 *   - Input trimming behavior
 *   - Auth status transitions displayed correctly
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { useAuthStore } from '@/stores/authStore';

// Mock auth service
const mockSetStoredBackendUrl = jest.fn(async () => {});
const mockSetSessionToken = jest.fn(async () => {});
const mockGenerateSessionToken = jest.fn(() => 'mock-uuid-token');

jest.mock('@/services/auth', () => ({
  setSessionToken: (...args: unknown[]) => (mockSetSessionToken as (...a: unknown[]) => Promise<void>)(...args),
  setStoredBackendUrl: (...args: unknown[]) => (mockSetStoredBackendUrl as (...a: unknown[]) => Promise<void>)(...args),
  generateSessionToken: () => mockGenerateSessionToken(),
}));

// Mock wsClient
const mockConnect = jest.fn();
jest.mock('@/services/wsClient', () => ({
  connect: (...args: unknown[]) => mockConnect(...args),
  disconnect: jest.fn(),
  onMessage: jest.fn(() => () => {}),
  loadPersistedMessages: jest.fn(async () => {}),
}));

import { PairingScreen } from './PairingScreen';

describe('PairingScreen edge cases', () => {
  beforeEach(() => {
    useAuthStore.setState({
      sessionToken: null,
      backendUrl: null,
      authStatus: 'unconfigured',
      pairingError: null,
    });
    jest.clearAllMocks();
  });

  describe('whitespace input validation', () => {
    it('button remains disabled when URL is only whitespace', () => {
      const { getByLabelText } = render(<PairingScreen />);
      const urlInput = getByLabelText('Backend URL');
      const tokenInput = getByLabelText('Pairing Token');

      fireEvent.changeText(urlInput, '   ');
      fireEvent.changeText(tokenInput, 'valid-token');

      const button = getByLabelText('Connect to backend');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });

    it('button remains disabled when token is only whitespace', () => {
      const { getByLabelText } = render(<PairingScreen />);
      const urlInput = getByLabelText('Backend URL');
      const tokenInput = getByLabelText('Pairing Token');

      fireEvent.changeText(urlInput, 'ws://localhost:8000/ws');
      fireEvent.changeText(tokenInput, '  \t  ');

      const button = getByLabelText('Connect to backend');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });

    it('button remains disabled when both inputs are only whitespace', () => {
      const { getByLabelText } = render(<PairingScreen />);
      const urlInput = getByLabelText('Backend URL');
      const tokenInput = getByLabelText('Pairing Token');

      fireEvent.changeText(urlInput, '   ');
      fireEvent.changeText(tokenInput, '   ');

      const button = getByLabelText('Connect to backend');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('input trimming', () => {
    it('trims URL before storing when connecting', async () => {
      const { getByLabelText } = render(<PairingScreen />);
      const urlInput = getByLabelText('Backend URL');
      const tokenInput = getByLabelText('Pairing Token');

      fireEvent.changeText(urlInput, '  ws://192.168.1.42:8000/ws  ');
      fireEvent.changeText(tokenInput, 'pairing-token');

      const button = getByLabelText('Connect to backend');
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockSetStoredBackendUrl).toHaveBeenCalledWith(
          'ws://192.168.1.42:8000/ws'
        );
      });
    });

    it('trims pairing token before sending to connect', async () => {
      const { getByLabelText } = render(<PairingScreen />);
      const urlInput = getByLabelText('Backend URL');
      const tokenInput = getByLabelText('Pairing Token');

      fireEvent.changeText(urlInput, 'ws://host:8000/ws');
      fireEvent.changeText(tokenInput, '  my-pairing-uuid  ');

      const button = getByLabelText('Connect to backend');
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockConnect).toHaveBeenCalledWith(
          'ws://host:8000/ws',
          'my-pairing-uuid'
        );
      });
    });
  });

  describe('loading state prevents interaction', () => {
    it('button is disabled during pairing status', () => {
      useAuthStore.setState({ authStatus: 'pairing' });
      const { getByLabelText } = render(<PairingScreen />);

      const urlInput = getByLabelText('Backend URL');
      const tokenInput = getByLabelText('Pairing Token');
      fireEvent.changeText(urlInput, 'ws://host/ws');
      fireEvent.changeText(tokenInput, 'token');

      const button = getByLabelText('Connect to backend');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });

    it('button is disabled during authenticating status', () => {
      useAuthStore.setState({ authStatus: 'authenticating' });
      const { getByLabelText } = render(<PairingScreen />);

      const urlInput = getByLabelText('Backend URL');
      const tokenInput = getByLabelText('Pairing Token');
      fireEvent.changeText(urlInput, 'ws://host/ws');
      fireEvent.changeText(tokenInput, 'token');

      const button = getByLabelText('Connect to backend');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('error display edge cases', () => {
    it('displays long error messages without truncation', () => {
      const longError =
        'Authentication failed because the pairing token has already been consumed by another device. Please restart your backend to generate a new pairing token.';
      useAuthStore.setState({ pairingError: longError });

      const { getByText } = render(<PairingScreen />);
      expect(getByText(longError)).toBeTruthy();
    });

    it('clears previous error when starting a new connection attempt', async () => {
      useAuthStore.setState({
        pairingError: 'Previous error',
        authStatus: 'auth_failed',
      });

      const { getByLabelText, getByText, queryByText } = render(
        <PairingScreen />
      );

      // Error should be visible initially
      expect(getByText('Previous error')).toBeTruthy();

      // Fill in inputs and press connect
      const urlInput = getByLabelText('Backend URL');
      const tokenInput = getByLabelText('Pairing Token');
      fireEvent.changeText(urlInput, 'ws://host/ws');
      fireEvent.changeText(tokenInput, 'new-token');

      const button = getByLabelText('Connect to backend');
      fireEvent.press(button);

      await waitFor(() => {
        // Error should be cleared (setPairingError(null) is called in handleConnect)
        expect(useAuthStore.getState().pairingError).toBeNull();
      });
    });
  });

  describe('connect action details', () => {
    it('sets backendUrl in authStore when connecting', async () => {
      const { getByLabelText } = render(<PairingScreen />);

      fireEvent.changeText(
        getByLabelText('Backend URL'),
        'ws://192.168.1.42:8000/ws'
      );
      fireEvent.changeText(getByLabelText('Pairing Token'), 'my-token');
      fireEvent.press(getByLabelText('Connect to backend'));

      await waitFor(() => {
        expect(useAuthStore.getState().backendUrl).toBe(
          'ws://192.168.1.42:8000/ws'
        );
      });
    });

    it('sets sessionToken in authStore when connecting', async () => {
      const { getByLabelText } = render(<PairingScreen />);

      fireEvent.changeText(
        getByLabelText('Backend URL'),
        'ws://host:8000/ws'
      );
      fireEvent.changeText(getByLabelText('Pairing Token'), 'token');
      fireEvent.press(getByLabelText('Connect to backend'));

      await waitFor(() => {
        expect(useAuthStore.getState().sessionToken).toBe('mock-uuid-token');
      });
    });

    it('calls wsClient.connect with URL and pairing token', async () => {
      const { getByLabelText } = render(<PairingScreen />);

      fireEvent.changeText(
        getByLabelText('Backend URL'),
        'ws://myhost:8000/ws'
      );
      fireEvent.changeText(getByLabelText('Pairing Token'), 'pairing-abc');
      fireEvent.press(getByLabelText('Connect to backend'));

      await waitFor(() => {
        expect(mockConnect).toHaveBeenCalledWith(
          'ws://myhost:8000/ws',
          'pairing-abc'
        );
      });
    });

    it('generates a session token via generateSessionToken()', async () => {
      const { getByLabelText } = render(<PairingScreen />);

      fireEvent.changeText(
        getByLabelText('Backend URL'),
        'ws://host:8000/ws'
      );
      fireEvent.changeText(getByLabelText('Pairing Token'), 'tok');
      fireEvent.press(getByLabelText('Connect to backend'));

      await waitFor(() => {
        expect(mockGenerateSessionToken).toHaveBeenCalled();
        expect(mockSetSessionToken).toHaveBeenCalledWith('mock-uuid-token');
      });
    });
  });

  describe('auth_failed state', () => {
    it('renders without loading indicator when auth_failed', () => {
      useAuthStore.setState({ authStatus: 'auth_failed' });
      const { queryByTestId } = render(<PairingScreen />);
      expect(queryByTestId('pairing-loading')).toBeNull();
    });

    it('allows re-connection after auth failure', () => {
      useAuthStore.setState({
        authStatus: 'auth_failed',
        pairingError: 'Token invalid',
      });

      const { getByLabelText } = render(<PairingScreen />);
      const urlInput = getByLabelText('Backend URL');
      const tokenInput = getByLabelText('Pairing Token');

      fireEvent.changeText(urlInput, 'ws://host/ws');
      fireEvent.changeText(tokenInput, 'new-valid-token');

      const button = getByLabelText('Connect to backend');
      // Button should be enabled for re-attempt
      expect(button.props.accessibilityState?.disabled).toBe(false);
    });
  });
});
