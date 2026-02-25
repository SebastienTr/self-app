/**
 * Edge case tests for ModuleLink component (story 2-5b).
 *
 * Tests boundary conditions: long titles, empty strings, special characters,
 * rapid taps, and missing/undefined props.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { ModuleLink } from './ModuleLink';

describe('ModuleLink edge cases', () => {
  describe('title edge cases', () => {
    it('renders very long title without crashing (truncated by numberOfLines)', () => {
      const longTitle = 'A'.repeat(500);
      const { getByText } = render(
        <ModuleLink moduleId="mod-1" title={longTitle} />,
      );
      expect(getByText(longTitle)).toBeTruthy();
    });

    it('renders title with special characters', () => {
      const special = 'M\u00f3dule <Test> & "Quotes"';
      const { getByText } = render(
        <ModuleLink moduleId="mod-1" title={special} />,
      );
      expect(getByText(special)).toBeTruthy();
    });

    it('renders title with unicode/emoji characters', () => {
      const unicodeTitle = '\uD83C\uDF26\uFE0F Weather in P\u00e1ris \u2603\uFE0F';
      const { getByText } = render(
        <ModuleLink moduleId="mod-1" title={unicodeTitle} />,
      );
      expect(getByText(unicodeTitle)).toBeTruthy();
    });

    it('renders empty string title without crashing', () => {
      expect(() =>
        render(<ModuleLink moduleId="mod-1" title="" />),
      ).not.toThrow();
    });
  });

  describe('emoji edge cases', () => {
    it('renders complex multi-codepoint emoji', () => {
      const complexEmoji = '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66';
      const { getByText } = render(
        <ModuleLink moduleId="mod-1" title="Family" emoji={complexEmoji} />,
      );
      expect(getByText(complexEmoji)).toBeTruthy();
    });

    it('renders with empty string emoji (no crash)', () => {
      expect(() =>
        render(<ModuleLink moduleId="mod-1" title="Test" emoji="" />),
      ).not.toThrow();
    });

    it('renders with undefined emoji (no emoji element)', () => {
      const { getByText } = render(
        <ModuleLink moduleId="mod-1" title="Test" emoji={undefined} />,
      );
      expect(getByText('Test')).toBeTruthy();
    });
  });

  describe('rapid press handling', () => {
    it('fires onPress for each rapid tap', () => {
      const onPress = jest.fn();
      const { getByRole } = render(
        <ModuleLink moduleId="mod-1" title="Test" onPress={onPress} />,
      );
      const link = getByRole('link');
      fireEvent.press(link);
      fireEvent.press(link);
      fireEvent.press(link);
      expect(onPress).toHaveBeenCalledTimes(3);
      expect(onPress).toHaveBeenCalledWith('mod-1');
    });
  });

  describe('moduleId edge cases', () => {
    it('passes moduleId with special characters to onPress', () => {
      const onPress = jest.fn();
      const specialId = 'mod/with-special_chars.v2';
      const { getByRole } = render(
        <ModuleLink moduleId={specialId} title="Test" onPress={onPress} />,
      );
      fireEvent.press(getByRole('link'));
      expect(onPress).toHaveBeenCalledWith(specialId);
    });

    it('accessibility label reflects the exact title', () => {
      const { getByLabelText } = render(
        <ModuleLink moduleId="mod-1" title='Mod "Quoted"' />,
      );
      expect(getByLabelText('View module: Mod "Quoted"')).toBeTruthy();
    });
  });
});
