/**
 * Edge-case tests for Orb shell component — Story 2.1 TEA expansion.
 *
 * Covers paths NOT exercised by Orb.test.tsx:
 *   - accessibility label for 'discovering' state
 *   - accessibility label for 'composing' state
 *   - connectionStore disconnected state does not crash Orb
 *   - reduced motion with non-idle agentStatus (labels still correct)
 *   - reduced motion check is called on mount
 *   - Orb renders with connectionStore 'connecting' status
 *   - Orb renders with connectionStore 'reconnecting' status
 *   - agentStatus transition from thinking to idle (re-render)
 */

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
import { render, waitFor, act } from '@testing-library/react-native';
import { useChatStore } from '@/stores/chatStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { Orb } from './Orb';

const mockUseChatStore = useChatStore as jest.MockedFunction<typeof useChatStore>;
const mockUseConnectionStore = useConnectionStore as jest.MockedFunction<typeof useConnectionStore>;

describe('Orb — edge cases', () => {
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

  describe('accessibility labels — all AgentState values', () => {
    it('has correct accessibility label for discovering state', async () => {
      mockUseChatStore.mockReturnValue('discovering' as ReturnType<typeof useChatStore>);
      const { getByLabelText } = render(<Orb />);
      await waitFor(() => {
        expect(getByLabelText('Agent status: discovering')).toBeTruthy();
      });
    });

    it('has correct accessibility label for composing state', async () => {
      mockUseChatStore.mockReturnValue('composing' as ReturnType<typeof useChatStore>);
      const { getByLabelText } = render(<Orb />);
      await waitFor(() => {
        expect(getByLabelText('Agent status: composing')).toBeTruthy();
      });
    });

    it('has correct accessibility label for thinking state', async () => {
      mockUseChatStore.mockReturnValue('thinking' as ReturnType<typeof useChatStore>);
      const { getByLabelText } = render(<Orb />);
      await waitFor(() => {
        expect(getByLabelText('Agent status: thinking')).toBeTruthy();
      });
    });
  });

  describe('connectionStore status variants', () => {
    it('renders without crashing when connectionStore is disconnected', () => {
      mockUseConnectionStore.mockReturnValue('disconnected' as ReturnType<typeof useConnectionStore>);
      expect(() => render(<Orb />)).not.toThrow();
    });

    it('renders without crashing when connectionStore is connecting', () => {
      mockUseConnectionStore.mockReturnValue('connecting' as ReturnType<typeof useConnectionStore>);
      expect(() => render(<Orb />)).not.toThrow();
    });

    it('renders without crashing when connectionStore is reconnecting', () => {
      mockUseConnectionStore.mockReturnValue('reconnecting' as ReturnType<typeof useConnectionStore>);
      expect(() => render(<Orb />)).not.toThrow();
    });
  });

  describe('reduced motion — with non-idle agentStatus', () => {
    it('renders static orb with correct label when reduce motion + thinking', async () => {
      jest
        .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
        .mockResolvedValue(true);
      mockUseChatStore.mockReturnValue('thinking' as ReturnType<typeof useChatStore>);

      const { getByLabelText } = render(<Orb />);
      await waitFor(() => {
        expect(getByLabelText('Agent status: thinking')).toBeTruthy();
      });
    });

    it('renders static orb with correct label when reduce motion + discovering', async () => {
      jest
        .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
        .mockResolvedValue(true);
      mockUseChatStore.mockReturnValue('discovering' as ReturnType<typeof useChatStore>);

      const { getByLabelText } = render(<Orb />);
      await waitFor(() => {
        expect(getByLabelText('Agent status: discovering')).toBeTruthy();
      });
    });
  });

  describe('AccessibilityInfo.isReduceMotionEnabled called on mount', () => {
    it('calls isReduceMotionEnabled on mount', () => {
      const spy = jest
        .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
        .mockResolvedValue(false);

      render(<Orb />);

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('agentStatus transition — re-render', () => {
    it('updates accessibility label when agentStatus changes from idle to thinking', async () => {
      mockUseChatStore.mockReturnValue('idle' as ReturnType<typeof useChatStore>);
      const { getByLabelText, rerender } = render(<Orb />);

      await waitFor(() => {
        expect(getByLabelText('Agent status: idle')).toBeTruthy();
      });

      // Simulate agentStatus change
      mockUseChatStore.mockReturnValue('thinking' as ReturnType<typeof useChatStore>);
      rerender(<Orb />);

      await waitFor(() => {
        expect(getByLabelText('Agent status: thinking')).toBeTruthy();
      });
    });

    it('updates accessibility label when agentStatus transitions back to idle', async () => {
      mockUseChatStore.mockReturnValue('thinking' as ReturnType<typeof useChatStore>);
      const { getByLabelText, rerender } = render(<Orb />);

      await waitFor(() => {
        expect(getByLabelText('Agent status: thinking')).toBeTruthy();
      });

      mockUseChatStore.mockReturnValue('idle' as ReturnType<typeof useChatStore>);
      rerender(<Orb />);

      await waitFor(() => {
        expect(getByLabelText('Agent status: idle')).toBeTruthy();
      });
    });
  });

  describe('mount and unmount', () => {
    it('unmounts without errors', async () => {
      const { unmount } = render(<Orb />);
      await act(async () => {
        expect(() => unmount()).not.toThrow();
      });
    });

    it('unmounts without errors in thinking state', async () => {
      mockUseChatStore.mockReturnValue('thinking' as ReturnType<typeof useChatStore>);
      const { unmount } = render(<Orb />);
      await act(async () => {
        expect(() => unmount()).not.toThrow();
      });
    });
  });
});
