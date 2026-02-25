/**
 * Edge case tests for PromptChips shell component (story 2-4).
 *
 * Tests fade-out animation completion behavior, styling compliance,
 * layout structure, persona switching, and accessibility roles.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { PromptChips } from './PromptChips';

describe('PromptChips edge cases', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('fade-out animation does not crash when component unmounts mid-animation', () => {
    const onChipPress = jest.fn();
    const { rerender, unmount } = render(
      <PromptChips onChipPress={onChipPress} persona={null} visible={true} />,
    );

    // Trigger fade out by setting visible to false
    rerender(
      <PromptChips onChipPress={onChipPress} persona={null} visible={false} />,
    );

    // Unmount during the 300ms fade animation — should not throw
    expect(() => unmount()).not.toThrow();
  });

  it('transitioning visible from true to false to true does not crash', () => {
    const onChipPress = jest.fn();
    const { rerender } = render(
      <PromptChips onChipPress={onChipPress} persona={null} visible={true} />,
    );

    rerender(
      <PromptChips onChipPress={onChipPress} persona={null} visible={false} />,
    );

    rerender(
      <PromptChips onChipPress={onChipPress} persona={null} visible={true} />,
    );

    // No crash means animation transitions are handled gracefully
    expect(true).toBe(true);
  });

  describe('chip styling compliance', () => {
    it('universal chips use accentSubtle (#12203A) background color', () => {
      const onChipPress = jest.fn();
      const { getByLabelText } = render(
        <PromptChips onChipPress={onChipPress} persona={null} visible={true} />,
      );
      const chip = getByLabelText("What's the weather like?");
      const style = Array.isArray(chip.props.style)
        ? Object.assign({}, ...chip.props.style.filter(Boolean))
        : chip.props.style;
      expect(style.backgroundColor).toBe('#12203A');
    });

    it('universal chips use accent (#E8A84C) border color', () => {
      const onChipPress = jest.fn();
      const { getByLabelText } = render(
        <PromptChips onChipPress={onChipPress} persona={null} visible={true} />,
      );
      const chip = getByLabelText('Track something for me');
      const style = Array.isArray(chip.props.style)
        ? Object.assign({}, ...chip.props.style.filter(Boolean))
        : chip.props.style;
      expect(style.borderColor).toBe('#E8A84C');
    });

    it('universal chips use 16px border radius', () => {
      const onChipPress = jest.fn();
      const { getByLabelText } = render(
        <PromptChips onChipPress={onChipPress} persona={null} visible={true} />,
      );
      const chip = getByLabelText('Help me organize my week');
      const style = Array.isArray(chip.props.style)
        ? Object.assign({}, ...chip.props.style.filter(Boolean))
        : chip.props.style;
      expect(style.borderRadius).toBe(16);
    });

    it('universal chips do not have dashed border style', () => {
      const onChipPress = jest.fn();
      const { getByLabelText } = render(
        <PromptChips onChipPress={onChipPress} persona={null} visible={true} />,
      );
      const chip = getByLabelText("What's the weather like?");
      const style = Array.isArray(chip.props.style)
        ? Object.assign({}, ...chip.props.style.filter(Boolean))
        : chip.props.style;
      // Universal chips should NOT have borderStyle: 'dashed'
      expect(style.borderStyle).toBeUndefined();
    });

    it('chips have 1px border width', () => {
      const onChipPress = jest.fn();
      const { getByLabelText } = render(
        <PromptChips onChipPress={onChipPress} persona={null} visible={true} />,
      );
      const chip = getByLabelText("What's the weather like?");
      const style = Array.isArray(chip.props.style)
        ? Object.assign({}, ...chip.props.style.filter(Boolean))
        : chip.props.style;
      expect(style.borderWidth).toBe(1);
    });

    it('chips have correct padding (7px vertical, 14px horizontal)', () => {
      const onChipPress = jest.fn();
      const { getByLabelText } = render(
        <PromptChips onChipPress={onChipPress} persona={null} visible={true} />,
      );
      const chip = getByLabelText("What's the weather like?");
      const style = Array.isArray(chip.props.style)
        ? Object.assign({}, ...chip.props.style.filter(Boolean))
        : chip.props.style;
      expect(style.paddingVertical).toBe(7);
      expect(style.paddingHorizontal).toBe(14);
    });
  });

  describe('container layout', () => {
    it('container uses horizontal flexWrap layout', () => {
      const onChipPress = jest.fn();
      const { toJSON } = render(
        <PromptChips onChipPress={onChipPress} persona={null} visible={true} />,
      );
      const root = toJSON() as any;
      const style = Array.isArray(root.props.style)
        ? Object.assign({}, ...root.props.style.filter(Boolean))
        : root.props.style;
      expect(style.flexDirection).toBe('row');
      expect(style.flexWrap).toBe('wrap');
    });

    it('container has gap of 6 between chips', () => {
      const onChipPress = jest.fn();
      const { toJSON } = render(
        <PromptChips onChipPress={onChipPress} persona={null} visible={true} />,
      );
      const root = toJSON() as any;
      const style = Array.isArray(root.props.style)
        ? Object.assign({}, ...root.props.style.filter(Boolean))
        : root.props.style;
      expect(style.gap).toBe(6);
    });

    it('container has horizontal padding of 14px', () => {
      const onChipPress = jest.fn();
      const { toJSON } = render(
        <PromptChips onChipPress={onChipPress} persona={null} visible={true} />,
      );
      const root = toJSON() as any;
      const style = Array.isArray(root.props.style)
        ? Object.assign({}, ...root.props.style.filter(Boolean))
        : root.props.style;
      expect(style.paddingHorizontal).toBe(14);
    });
  });

  describe('accessibility roles', () => {
    it('all chips have accessibilityRole="button"', () => {
      const onChipPress = jest.fn();
      const { getByLabelText } = render(
        <PromptChips onChipPress={onChipPress} persona="flame" visible={true} />,
      );
      const chips = [
        "What's the weather like?",
        'Track something for me',
        'Help me organize my week',
        'Automate something',
      ];
      for (const label of chips) {
        const chip = getByLabelText(label);
        expect(chip.props.accessibilityRole).toBe('button');
      }
    });
  });

  describe('persona switching', () => {
    it('switching persona from flame to tree replaces persona chip', () => {
      const onChipPress = jest.fn();
      const { rerender, queryByText, getByText } = render(
        <PromptChips onChipPress={onChipPress} persona="flame" visible={true} />,
      );
      expect(getByText('Automate something')).toBeTruthy();

      rerender(
        <PromptChips onChipPress={onChipPress} persona="tree" visible={true} />,
      );
      expect(queryByText('Automate something')).toBeNull();
      expect(getByText("Let's chat first")).toBeTruthy();
    });

    it('switching persona from star to null removes persona chip', () => {
      const onChipPress = jest.fn();
      const { rerender, queryByText } = render(
        <PromptChips onChipPress={onChipPress} persona="star" visible={true} />,
      );
      expect(queryByText('Surprise me')).toBeTruthy();

      rerender(
        <PromptChips onChipPress={onChipPress} persona={null} visible={true} />,
      );
      expect(queryByText('Surprise me')).toBeNull();
    });

    it('pressing each universal chip calls handler with correct text', () => {
      const onChipPress = jest.fn();
      const { getByText } = render(
        <PromptChips onChipPress={onChipPress} persona={null} visible={true} />,
      );

      fireEvent.press(getByText("What's the weather like?"));
      expect(onChipPress).toHaveBeenCalledWith("What's the weather like?");

      fireEvent.press(getByText('Help me organize my week'));
      expect(onChipPress).toHaveBeenCalledWith('Help me organize my week');

      expect(onChipPress).toHaveBeenCalledTimes(2);
    });
  });
});
