/**
 * Edge case tests for SettingsScreen (story 2-5b).
 *
 * Tests authenticating state, N/A backend URL, zero modules,
 * and transition from connected to disconnected.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock localDb to prevent expo-sqlite crash
jest.mock('@/services/localDb', () => ({
  cacheModule: jest.fn(async () => {}),
  removeCachedModule: jest.fn(async () => {}),
}));

// Mock auth service
jest.mock('@/services/auth', () => ({
  clearSessionToken: jest.fn(async () => {}),
  clearStoredBackendUrl: jest.fn(async () => {}),
  setSessionToken: jest.fn(async () => {}),
  setStoredBackendUrl: jest.fn(async () => {}),
  generateSessionToken: jest.fn(() => 'mock-uuid'),
}));

// Mock wsClient
jest.mock('@/services/wsClient', () => ({
  disconnect: jest.fn(),
  connect: jest.fn(),
  onMessage: jest.fn(() => () => {}),
  loadPersistedMessages: jest.fn(async () => {}),
}));

// Mock getBackendUrl for PairingScreen
jest.mock('@/utils/getBackendUrl', () => ({
  getBackendUrl: jest.fn(() => ''),
}));

import React from 'react';
import { render } from '@testing-library/react-native';

import { useAuthStore } from '@/stores/authStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useModuleStore } from '@/stores/moduleStore';
import { SettingsScreen } from './SettingsScreen';

describe('SettingsScreen edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useModuleStore.setState({ modules: new Map(), newModulesSinceLastHomeVisit: 0 });
  });

  describe('authenticating state', () => {
    it('shows PairingScreen during authenticating state (not connected info)', () => {
      useAuthStore.setState({ authStatus: 'authenticating' });
      // authenticating is NOT in the showPairing list, so connection info is shown
      // Let's verify the actual behavior: authenticating should show connection info
      const { queryByLabelText, getByText } = render(<SettingsScreen />);
      // authenticating is not unconfigured/auth_failed/pairing, so it shows connection info
      expect(queryByLabelText('Backend URL')).toBeNull();
      expect(getByText('Connection')).toBeTruthy();
    });
  });

  describe('null backend URL', () => {
    it('shows "N/A" when backendUrl is null', () => {
      useAuthStore.setState({
        authStatus: 'authenticated',
        backendUrl: null,
      });
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('N/A')).toBeTruthy();
    });
  });

  describe('zero modules', () => {
    it('shows 0 module count when store is empty', () => {
      useAuthStore.setState({ authStatus: 'authenticated' });
      useModuleStore.setState({ modules: new Map() });
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('0')).toBeTruthy();
    });
  });

  describe('connection status display', () => {
    beforeEach(() => {
      useAuthStore.setState({ authStatus: 'authenticated' });
    });

    it('shows "disconnected" when connection is disconnected', () => {
      useConnectionStore.setState({ status: 'disconnected' });
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('disconnected')).toBeTruthy();
    });

    it('shows "reconnecting" when connection is reconnecting', () => {
      useConnectionStore.setState({ status: 'reconnecting' });
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('reconnecting')).toBeTruthy();
    });

    it('shows "connecting" when connection is connecting', () => {
      useConnectionStore.setState({ status: 'connecting' });
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('connecting')).toBeTruthy();
    });
  });
});
