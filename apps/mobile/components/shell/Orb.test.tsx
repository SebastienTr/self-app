/**
 * Unit tests for Orb shell component.
 *
 * Tests idle/thinking states and reduced motion fallback.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock chatStore
jest.mock('@/stores/chatStore', () => ({
  useChatStore: jest.fn(),
}));

// Mock connectionStore
jest.mock('@/stores/connectionStore', () => ({
  useConnectionStore: jest.fn(),
}));

import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { useChatStore } from '@/stores/chatStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { Orb } from './Orb';

const mockUseChatStore = useChatStore as jest.MockedFunction<typeof useChatStore>;
const mockUseConnectionStore = useConnectionStore as jest.MockedFunction<typeof useConnectionStore>;

describe('Orb', () => {
  beforeEach(() => {
    mockUseChatStore.mockReturnValue('idle' as ReturnType<typeof useChatStore>);
    mockUseConnectionStore.mockReturnValue('connected' as ReturnType<typeof useConnectionStore>);
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders without crashing', () => {
      expect(() => render(<Orb />)).not.toThrow();
    });

    it('has accessibility label for idle state', async () => {
      const { getByLabelText } = render(<Orb />);
      await waitFor(() => {
        expect(getByLabelText('Agent status: idle')).toBeTruthy();
      });
    });

    it('has accessibility label for thinking state', async () => {
      mockUseChatStore.mockReturnValue('thinking' as ReturnType<typeof useChatStore>);
      const { getByLabelText } = render(<Orb />);
      await waitFor(() => {
        expect(getByLabelText('Agent status: thinking')).toBeTruthy();
      });
    });
  });

  describe('agent states', () => {
    it('renders for idle agentStatus', () => {
      mockUseChatStore.mockReturnValue('idle' as ReturnType<typeof useChatStore>);
      expect(() => render(<Orb />)).not.toThrow();
    });

    it('renders for thinking agentStatus', () => {
      mockUseChatStore.mockReturnValue('thinking' as ReturnType<typeof useChatStore>);
      expect(() => render(<Orb />)).not.toThrow();
    });

    it('renders for streaming agentStatus', () => {
      mockUseChatStore.mockReturnValue('streaming' as ReturnType<typeof useChatStore>);
      expect(() => render(<Orb />)).not.toThrow();
    });

    it('renders for discovering agentStatus', () => {
      mockUseChatStore.mockReturnValue('discovering' as ReturnType<typeof useChatStore>);
      expect(() => render(<Orb />)).not.toThrow();
    });

    it('renders for composing agentStatus', () => {
      mockUseChatStore.mockReturnValue('composing' as ReturnType<typeof useChatStore>);
      expect(() => render(<Orb />)).not.toThrow();
    });

    it('renders for saving agentStatus', () => {
      mockUseChatStore.mockReturnValue('saving' as ReturnType<typeof useChatStore>);
      expect(() => render(<Orb />)).not.toThrow();
    });
  });

  describe('reduced motion', () => {
    it('renders static orb when reduce motion is enabled', async () => {
      jest
        .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
        .mockResolvedValue(true);

      const { getByLabelText } = render(<Orb />);
      await waitFor(() => {
        expect(getByLabelText('Agent status: idle')).toBeTruthy();
      });
    });
  });
});
