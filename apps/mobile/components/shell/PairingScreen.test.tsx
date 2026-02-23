/**
 * Unit tests for PairingScreen component.
 *
 * Tests rendering, input validation, error display, loading states,
 * and accessibility labels.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { useAuthStore } from '@/stores/authStore';

// Mock auth service
jest.mock('@/services/auth', () => ({
  setSessionToken: jest.fn(async () => {}),
  setStoredBackendUrl: jest.fn(async () => {}),
  generateSessionToken: jest.fn(() => 'mock-uuid-token'),
}));

// Mock wsClient
jest.mock('@/services/wsClient', () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  onMessage: jest.fn(() => () => {}),
  loadPersistedMessages: jest.fn(async () => {}),
}));

// Mock getBackendUrl to return empty string in tests (no dev auto-fill)
jest.mock('@/utils/getBackendUrl', () => ({
  getBackendUrl: jest.fn(() => ''),
}));

import { PairingScreen } from './PairingScreen';

describe('PairingScreen', () => {
  beforeEach(() => {
    useAuthStore.setState({
      sessionToken: null,
      backendUrl: null,
      authStatus: 'unconfigured',
      pairingError: null,
    });
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders two text inputs', () => {
      const { getByLabelText } = render(<PairingScreen />);
      expect(getByLabelText('Backend URL')).toBeTruthy();
      expect(getByLabelText('Pairing Token')).toBeTruthy();
    });

    it('renders a connect button', () => {
      const { getByLabelText } = render(<PairingScreen />);
      expect(getByLabelText('Connect to backend')).toBeTruthy();
    });

    it('renders with correct placeholder text', () => {
      const { getByPlaceholderText } = render(<PairingScreen />);
      expect(getByPlaceholderText('ws://192.168.1.x:8000/ws')).toBeTruthy();
      expect(getByPlaceholderText('Paste pairing token here')).toBeTruthy();
    });
  });

  describe('connect button validation', () => {
    it('button is disabled when both inputs are empty', () => {
      const { getByLabelText } = render(<PairingScreen />);
      const button = getByLabelText('Connect to backend');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });

    it('button is disabled when only URL is entered', () => {
      const { getByLabelText } = render(<PairingScreen />);
      const urlInput = getByLabelText('Backend URL');
      fireEvent.changeText(urlInput, 'ws://localhost:8000/ws');
      const button = getByLabelText('Connect to backend');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });

    it('button is disabled when only token is entered', () => {
      const { getByLabelText } = render(<PairingScreen />);
      const tokenInput = getByLabelText('Pairing Token');
      fireEvent.changeText(tokenInput, 'some-token');
      const button = getByLabelText('Connect to backend');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });

    it('button is enabled when both inputs are filled', () => {
      const { getByLabelText } = render(<PairingScreen />);
      const urlInput = getByLabelText('Backend URL');
      const tokenInput = getByLabelText('Pairing Token');
      fireEvent.changeText(urlInput, 'ws://localhost:8000/ws');
      fireEvent.changeText(tokenInput, 'some-token');
      const button = getByLabelText('Connect to backend');
      expect(button.props.accessibilityState?.disabled).toBe(false);
    });
  });

  describe('error display', () => {
    it('displays error message when pairingError is set', () => {
      useAuthStore.setState({ pairingError: 'Invalid token' });
      const { getByText } = render(<PairingScreen />);
      expect(getByText('Invalid token')).toBeTruthy();
    });

    it('does not display error when pairingError is null', () => {
      const { queryByTestId } = render(<PairingScreen />);
      expect(queryByTestId('pairing-error')).toBeNull();
    });
  });

  describe('loading state', () => {
    it('shows loading indicator when authStatus is pairing', () => {
      useAuthStore.setState({ authStatus: 'pairing' });
      const { getByTestId } = render(<PairingScreen />);
      expect(getByTestId('pairing-loading')).toBeTruthy();
    });

    it('shows loading indicator when authStatus is authenticating', () => {
      useAuthStore.setState({ authStatus: 'authenticating' });
      const { getByTestId } = render(<PairingScreen />);
      expect(getByTestId('pairing-loading')).toBeTruthy();
    });

    it('does not show loading indicator when unconfigured', () => {
      const { queryByTestId } = render(<PairingScreen />);
      expect(queryByTestId('pairing-loading')).toBeNull();
    });
  });

  describe('accessibility', () => {
    it('has accessibility label on URL input', () => {
      const { getByLabelText } = render(<PairingScreen />);
      expect(getByLabelText('Backend URL')).toBeTruthy();
    });

    it('has accessibility label on token input', () => {
      const { getByLabelText } = render(<PairingScreen />);
      expect(getByLabelText('Pairing Token')).toBeTruthy();
    });

    it('has accessibility label on connect button', () => {
      const { getByLabelText } = render(<PairingScreen />);
      expect(getByLabelText('Connect to backend')).toBeTruthy();
    });
  });

  describe('connect action', () => {
    it('calls auth functions when connect is pressed', async () => {
      const { getByLabelText } = render(<PairingScreen />);
      const urlInput = getByLabelText('Backend URL');
      const tokenInput = getByLabelText('Pairing Token');

      fireEvent.changeText(urlInput, 'ws://192.168.1.42:8000/ws');
      fireEvent.changeText(tokenInput, 'my-pairing-token');

      const button = getByLabelText('Connect to backend');
      fireEvent.press(button);

      const auth = require('@/services/auth');
      await waitFor(() => {
        expect(auth.setStoredBackendUrl).toHaveBeenCalledWith('ws://192.168.1.42:8000/ws');
        expect(auth.setSessionToken).toHaveBeenCalledWith('mock-uuid-token');
      });
    });

    it('sets authStatus to pairing when connect is pressed', async () => {
      const { getByLabelText } = render(<PairingScreen />);
      const urlInput = getByLabelText('Backend URL');
      const tokenInput = getByLabelText('Pairing Token');

      fireEvent.changeText(urlInput, 'ws://localhost:8000/ws');
      fireEvent.changeText(tokenInput, 'token');

      const button = getByLabelText('Connect to backend');
      fireEvent.press(button);

      await waitFor(() => {
        expect(useAuthStore.getState().authStatus).toBe('pairing');
      });
    });
  });
});
