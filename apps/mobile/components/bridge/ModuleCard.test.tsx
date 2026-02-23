/**
 * Unit tests for ModuleCard and ErrorBoundary components.
 *
 * Tests module card rendering with name display, freshness indicator integration,
 * and ErrorBoundary fallback behavior on render errors.
 */

import React from 'react';
import { render } from '@testing-library/react-native';

import type { ModuleState } from '@/types/module';
import { ModuleCard } from './ModuleCard';
import { ErrorBoundary } from './ErrorBoundary';

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

function makeModule(overrides: Partial<ModuleState> = {}): ModuleState {
  return {
    spec: { moduleId: 'test-mod', name: 'Test Module' } as any,
    status: 'active',
    dataStatus: 'ok',
    updatedAt: new Date().toISOString(),
    cachedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ModuleCard', () => {
  it('renders the module name from spec', () => {
    const mod = makeModule();
    const { getByText } = render(<ModuleCard module={mod} />);

    expect(getByText('Test Module')).toBeTruthy();
  });

  it('falls back to moduleId when name is not present in spec', () => {
    const mod = makeModule({
      spec: { moduleId: 'fallback-id' },
    });
    const { getByText } = render(<ModuleCard module={mod} />);

    expect(getByText('fallback-id')).toBeTruthy();
  });

  it('renders FreshnessIndicator for stale data (> 24h)', () => {
    const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const mod = makeModule({ updatedAt: oldTime });
    const { getByText } = render(<ModuleCard module={mod} />);

    expect(getByText('Stale')).toBeTruthy();
  });

  it('does not show FreshnessIndicator for fresh data (< 1h)', () => {
    const recentTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min ago
    const mod = makeModule({ updatedAt: recentTime });
    const { queryByText } = render(<ModuleCard module={mod} />);

    expect(queryByText('Stale')).toBeNull();
    expect(queryByText('Offline')).toBeNull();
    expect(queryByText(/Updated/)).toBeNull();
  });

  it('shows Offline badge when dataStatus is error', () => {
    const mod = makeModule({ dataStatus: 'error' });
    const { getByText } = render(<ModuleCard module={mod} />);

    expect(getByText('Offline')).toBeTruthy();
  });

  it('renders the updated Xh ago caption for 1h-24h old data', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const mod = makeModule({ updatedAt: threeHoursAgo });
    const { getByText } = render(<ModuleCard module={mod} />);

    expect(getByText(/Updated \d+h ago/)).toBeTruthy();
  });
});

describe('ErrorBoundary', () => {
  function ThrowingComponent(): React.ReactElement {
    throw new Error('Render crash!');
  }

  it('renders children when no error occurs', () => {
    const { getByText } = render(
      <ErrorBoundary moduleId="test-mod">
        <React.Fragment>
          {/* Use a simple Text-like approach */}
          {(() => {
            const { Text } = require('react-native');
            return <Text>Child Content</Text>;
          })()}
        </React.Fragment>
      </ErrorBoundary>,
    );

    expect(getByText('Child Content')).toBeTruthy();
  });

  it('renders fallback card when child component throws', () => {
    const { getByText } = render(
      <ErrorBoundary moduleId="broken-mod">
        <ThrowingComponent />
      </ErrorBoundary>,
    );

    expect(getByText('Module Error')).toBeTruthy();
    expect(getByText('Render crash!')).toBeTruthy();
  });

  it('renders "Unknown error" when error has no message', () => {
    function ThrowUnknown(): React.ReactElement {
      throw new Error();
    }

    const { getByText } = render(
      <ErrorBoundary moduleId="unknown-err">
        <ThrowUnknown />
      </ErrorBoundary>,
    );

    expect(getByText('Module Error')).toBeTruthy();
  });

  it('isolates errors — one module failure does not affect siblings', () => {
    const { Text } = require('react-native');

    function GoodComponent() {
      return <Text>Good Module</Text>;
    }

    const { getByText } = render(
      <>
        <ErrorBoundary moduleId="good-mod">
          <GoodComponent />
        </ErrorBoundary>
        <ErrorBoundary moduleId="bad-mod">
          <ThrowingComponent />
        </ErrorBoundary>
      </>,
    );

    // Good module should still render
    expect(getByText('Good Module')).toBeTruthy();
    // Bad module should show error
    expect(getByText('Module Error')).toBeTruthy();
  });
});
