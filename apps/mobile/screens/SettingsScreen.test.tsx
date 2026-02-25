/**
 * Unit tests for SettingsScreen (story 2-5b).
 *
 * Tests pairing mode (unconfigured), connection info mode (authenticated),
 * disconnect flow, and About section.
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
  sendSetPersona: jest.fn(),
}));

// Mock getBackendUrl for PairingScreen
jest.mock('@/utils/getBackendUrl', () => ({
  getBackendUrl: jest.fn(() => ''),
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { useAuthStore } from '@/stores/authStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useModuleStore } from '@/stores/moduleStore';
import { SettingsScreen } from './SettingsScreen';

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      sessionToken: null,
      backendUrl: null,
      authStatus: 'unconfigured',
      pairingError: null,
    });
    useConnectionStore.setState({ status: 'disconnected', persona: null });
    useModuleStore.setState({ modules: new Map(), newModulesSinceLastHomeVisit: 0 });
  });

  describe('pairing mode', () => {
    it('shows PairingScreen when authStatus is unconfigured', () => {
      useAuthStore.setState({ authStatus: 'unconfigured' });
      const { getByLabelText } = render(<SettingsScreen />);
      // PairingScreen renders "Backend URL" input
      expect(getByLabelText('Backend URL')).toBeTruthy();
    });

    it('shows PairingScreen when authStatus is auth_failed', () => {
      useAuthStore.setState({ authStatus: 'auth_failed' });
      const { getByLabelText } = render(<SettingsScreen />);
      expect(getByLabelText('Backend URL')).toBeTruthy();
    });

    it('shows PairingScreen when authStatus is pairing', () => {
      useAuthStore.setState({ authStatus: 'pairing' });
      const { getByLabelText } = render(<SettingsScreen />);
      expect(getByLabelText('Backend URL')).toBeTruthy();
    });
  });

  describe('connection info mode', () => {
    beforeEach(() => {
      useAuthStore.setState({
        authStatus: 'authenticated',
        backendUrl: 'ws://192.168.1.42:8000/ws',
      });
      useConnectionStore.setState({ status: 'connected' });
    });

    it('shows Connection section title', () => {
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('Connection')).toBeTruthy();
    });

    it('shows backend URL', () => {
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('ws://192.168.1.42:8000/ws')).toBeTruthy();
    });

    it('shows connection status', () => {
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('connected')).toBeTruthy();
    });

    it('shows module count', () => {
      const modules = new Map();
      modules.set('mod-1', {
        spec: { moduleId: 'mod-1' },
        status: 'active',
        dataStatus: 'ok',
        updatedAt: new Date().toISOString(),
        cachedAt: new Date().toISOString(),
      });
      modules.set('mod-2', {
        spec: { moduleId: 'mod-2' },
        status: 'active',
        dataStatus: 'ok',
        updatedAt: new Date().toISOString(),
        cachedAt: new Date().toISOString(),
      });
      useModuleStore.setState({ modules });

      const { getByText } = render(<SettingsScreen />);
      expect(getByText('2')).toBeTruthy();
    });

    it('does not show PairingScreen when authenticated', () => {
      const { queryByLabelText } = render(<SettingsScreen />);
      expect(queryByLabelText('Backend URL')).toBeNull();
    });
  });

  describe('disconnect button', () => {
    beforeEach(() => {
      useAuthStore.setState({
        authStatus: 'authenticated',
        backendUrl: 'ws://localhost:8000/ws',
      });
      useConnectionStore.setState({ status: 'connected' });
    });

    it('renders disconnect button', () => {
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('Disconnect & Re-pair')).toBeTruthy();
    });

    it('has accessibility label for disconnect button', () => {
      const { getByLabelText } = render(<SettingsScreen />);
      expect(getByLabelText('Disconnect and re-pair')).toBeTruthy();
    });

    it('calls disconnect and clears auth on press', async () => {
      const wsClient = require('@/services/wsClient');
      const auth = require('@/services/auth');

      const { getByLabelText } = render(<SettingsScreen />);
      fireEvent.press(getByLabelText('Disconnect and re-pair'));

      await waitFor(() => {
        expect(wsClient.disconnect).toHaveBeenCalled();
        expect(auth.clearSessionToken).toHaveBeenCalled();
        expect(auth.clearStoredBackendUrl).toHaveBeenCalled();
      });
    });

    it('resets auth store to unconfigured after disconnect', async () => {
      const { getByLabelText } = render(<SettingsScreen />);
      fireEvent.press(getByLabelText('Disconnect and re-pair'));

      await waitFor(() => {
        expect(useAuthStore.getState().authStatus).toBe('unconfigured');
      });
    });
  });

  describe('About section', () => {
    beforeEach(() => {
      useAuthStore.setState({ authStatus: 'authenticated' });
    });

    it('shows About section title', () => {
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('About')).toBeTruthy();
    });

    it('shows app name "Self"', () => {
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('Self')).toBeTruthy();
    });

    it('shows version number', () => {
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('0.1.0')).toBeTruthy();
    });
  });

  describe('persona section (Story 2.3)', () => {
    beforeEach(() => {
      useAuthStore.setState({ authStatus: 'authenticated' });
      useConnectionStore.setState({ status: 'connected', persona: null });
    });

    it('shows Persona section title when authenticated', () => {
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('Persona')).toBeTruthy();
    });

    it('renders PersonaSelector with three persona options', () => {
      const { getByLabelText } = render(<SettingsScreen />);
      expect(getByLabelText('Select Flame persona')).toBeTruthy();
      expect(getByLabelText('Select Tree persona')).toBeTruthy();
      expect(getByLabelText('Select Star persona')).toBeTruthy();
    });

    it('highlights the active persona', () => {
      useConnectionStore.setState({ persona: 'tree' });
      const { getByLabelText } = render(<SettingsScreen />);
      const treeCard = getByLabelText('Select Tree persona');
      expect(treeCard.props.accessibilityState).toEqual({ selected: true });
    });

    it('calls sendSetPersona when a persona is tapped', () => {
      const wsClient = require('@/services/wsClient');
      const { getByLabelText } = render(<SettingsScreen />);
      fireEvent.press(getByLabelText('Select Flame persona'));
      expect(wsClient.sendSetPersona).toHaveBeenCalledWith('flame');
    });

    it('does not show Persona section when in pairing mode', () => {
      useAuthStore.setState({ authStatus: 'unconfigured' });
      const { queryByText } = render(<SettingsScreen />);
      expect(queryByText('Persona')).toBeNull();
    });
  });
});
