/**
 * Unit tests for FreshnessIndicator component.
 *
 * Tests data freshness display logic based on updatedAt and dataStatus.
 */

import React from 'react';
import { render } from '@testing-library/react-native';

import { FreshnessIndicator } from './FreshnessIndicator';

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('FreshnessIndicator', () => {
  const now = new Date();

  describe('< 1 hour old', () => {
    it('renders nothing when data is fresh', () => {
      const recentTime = new Date(now.getTime() - 30 * 60 * 1000).toISOString(); // 30 min ago
      const { queryByText, queryByLabelText } = render(
        <FreshnessIndicator updatedAt={recentTime} dataStatus="ok" />,
      );

      expect(queryByText(/Updated/)).toBeNull();
      expect(queryByText('Stale')).toBeNull();
      expect(queryByText('Offline')).toBeNull();
      expect(queryByLabelText(/Data last updated/)).toBeNull();
    });
  });

  describe('1h - 24h old', () => {
    it('renders "Updated Xh ago" caption', () => {
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
      const { getByText } = render(
        <FreshnessIndicator updatedAt={threeHoursAgo} dataStatus="ok" />,
      );

      expect(getByText(/Updated \d+h ago/)).toBeTruthy();
    });

    it('has accessible label', () => {
      const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString();
      const { getByLabelText } = render(
        <FreshnessIndicator updatedAt={fiveHoursAgo} dataStatus="ok" />,
      );

      expect(getByLabelText(/Data last updated \d+ hours ago/)).toBeTruthy();
    });
  });

  describe('> 24h old', () => {
    it('renders "Stale" badge', () => {
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
      const { getByText } = render(
        <FreshnessIndicator updatedAt={twoDaysAgo} dataStatus="ok" />,
      );

      expect(getByText('Stale')).toBeTruthy();
    });

    it('has accessible label for stale data', () => {
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
      const { getByLabelText } = render(
        <FreshnessIndicator updatedAt={twoDaysAgo} dataStatus="ok" />,
      );

      expect(getByLabelText(/Data last updated \d+ hours ago/)).toBeTruthy();
    });
  });

  describe('dataStatus === error (backend unreachable)', () => {
    it('renders "Offline" badge', () => {
      const recentTime = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
      const { getByText } = render(
        <FreshnessIndicator updatedAt={recentTime} dataStatus="error" />,
      );

      expect(getByText('Offline')).toBeTruthy();
    });

    it('has accessible label for offline state', () => {
      const recentTime = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
      const { getByLabelText } = render(
        <FreshnessIndicator updatedAt={recentTime} dataStatus="error" />,
      );

      expect(getByLabelText(/Offline/)).toBeTruthy();
    });

    it('shows Offline badge regardless of data age', () => {
      // Even if data is very old, error dataStatus should show Offline (not Stale)
      const veryOld = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000).toISOString();
      const { getByText, queryByText } = render(
        <FreshnessIndicator updatedAt={veryOld} dataStatus="error" />,
      );

      expect(getByText('Offline')).toBeTruthy();
      expect(queryByText('Stale')).toBeNull();
    });
  });

  // --- Boundary condition tests ---

  describe('boundary: exactly 1 hour', () => {
    it('renders caption at exactly 1 hour (boundary between fresh and caption)', () => {
      const exactlyOneHour = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const { getByText } = render(
        <FreshnessIndicator updatedAt={exactlyOneHour} dataStatus="ok" />,
      );

      expect(getByText(/Updated \d+h ago/)).toBeTruthy();
    });
  });

  describe('boundary: exactly 24 hours', () => {
    it('renders Stale badge at exactly 24 hours', () => {
      const exactly24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const { getByText } = render(
        <FreshnessIndicator updatedAt={exactly24h} dataStatus="ok" />,
      );

      expect(getByText('Stale')).toBeTruthy();
    });
  });

  describe('boundary: just under 1 hour', () => {
    it('renders nothing at 59 minutes', () => {
      const fiftyNineMin = new Date(now.getTime() - 59 * 60 * 1000).toISOString();
      const { queryByText, queryByLabelText } = render(
        <FreshnessIndicator updatedAt={fiftyNineMin} dataStatus="ok" />,
      );

      expect(queryByText(/Updated/)).toBeNull();
      expect(queryByText('Stale')).toBeNull();
      expect(queryByLabelText(/Data last updated/)).toBeNull();
    });
  });

  describe('boundary: just under 24 hours', () => {
    it('renders caption at 23 hours (not Stale)', () => {
      const twentyThreeHours = new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString();
      const { getByText, queryByText } = render(
        <FreshnessIndicator updatedAt={twentyThreeHours} dataStatus="ok" />,
      );

      expect(getByText(/Updated 23h ago/)).toBeTruthy();
      expect(queryByText('Stale')).toBeNull();
    });
  });

  describe('dataStatus === stale', () => {
    it('behaves same as ok (stale dataStatus does not trigger Offline badge)', () => {
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
      const { getByText, queryByText } = render(
        <FreshnessIndicator updatedAt={threeHoursAgo} dataStatus="stale" />,
      );

      // stale dataStatus is not 'error', so it should show time-based indicator
      expect(getByText(/Updated \d+h ago/)).toBeTruthy();
      expect(queryByText('Offline')).toBeNull();
    });
  });

  describe('very old data', () => {
    it('renders Stale badge for data that is weeks old', () => {
      const weeksOld = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { getByText } = render(
        <FreshnessIndicator updatedAt={weeksOld} dataStatus="ok" />,
      );

      expect(getByText('Stale')).toBeTruthy();
    });
  });
});
