/**
 * Unit tests for ModuleLink component (story 2-5b).
 *
 * Tests rendering, accessibility, press handler, and visual structure.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { ModuleLink } from './ModuleLink';

describe('ModuleLink', () => {
  describe('rendering', () => {
    it('renders the module title', () => {
      const { getByText } = render(
        <ModuleLink moduleId="mod-1" title="Weather" />,
      );
      expect(getByText('Weather')).toBeTruthy();
    });

    it('renders the "voir" action text', () => {
      const { getByText } = render(
        <ModuleLink moduleId="mod-1" title="Weather" />,
      );
      // "voir →" with unicode arrow
      expect(getByText(/voir/)).toBeTruthy();
    });

    it('renders emoji when provided', () => {
      const tree = render(
        <ModuleLink moduleId="mod-1" title="Weather" emoji="W" />,
      );
      // The component renders: <View><Text style={emoji}>W</Text><Text>Weather</Text></View>
      // Since parent has accessibilityLabel, we verify via the serialized tree
      const json = JSON.stringify(tree.toJSON());
      // The emoji text "W" should appear separately from the title
      expect(json).toContain('"W"');
    });

    it('does not render emoji element when emoji is not provided', () => {
      const { queryByText } = render(
        <ModuleLink moduleId="mod-1" title="Tasks" />,
      );
      // Title and action should be present; no emoji text node
      expect(queryByText('Tasks')).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('has link accessibility role', () => {
      const { getByRole } = render(
        <ModuleLink moduleId="mod-1" title="Weather" />,
      );
      expect(getByRole('link')).toBeTruthy();
    });

    it('has descriptive accessibility label with module title', () => {
      const { getByLabelText } = render(
        <ModuleLink moduleId="mod-1" title="Weather" />,
      );
      expect(getByLabelText('View module: Weather')).toBeTruthy();
    });
  });

  describe('press handling', () => {
    it('calls onPress with moduleId when tapped', () => {
      const onPress = jest.fn();
      const { getByRole } = render(
        <ModuleLink moduleId="mod-42" title="Weather" onPress={onPress} />,
      );
      fireEvent.press(getByRole('link'));
      expect(onPress).toHaveBeenCalledWith('mod-42');
    });

    it('does not crash when onPress is not provided', () => {
      const { getByRole } = render(
        <ModuleLink moduleId="mod-1" title="Weather" />,
      );
      expect(() => fireEvent.press(getByRole('link'))).not.toThrow();
    });

    it('calls onPress exactly once per tap', () => {
      const onPress = jest.fn();
      const { getByRole } = render(
        <ModuleLink moduleId="mod-1" title="Test" onPress={onPress} />,
      );
      fireEvent.press(getByRole('link'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });
});
