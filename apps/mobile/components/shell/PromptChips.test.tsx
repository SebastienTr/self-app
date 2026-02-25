/**
 * Unit tests for PromptChips shell component (story 2-4).
 *
 * Tests chip rendering per persona, press handler, styling, and accessibility.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { PromptChips } from './PromptChips';

describe('PromptChips', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('universal chips', () => {
    it('renders 3 universal chips when persona is null', () => {
      const onChipPress = jest.fn();
      const { getByText } = render(
        <PromptChips onChipPress={onChipPress} persona={null} visible={true} />,
      );
      expect(getByText("What's the weather like?")).toBeTruthy();
      expect(getByText('Track something for me')).toBeTruthy();
      expect(getByText('Help me organize my week')).toBeTruthy();
    });

    it('renders only 3 chips when persona is null (no persona chip)', () => {
      const onChipPress = jest.fn();
      const { queryByText } = render(
        <PromptChips onChipPress={onChipPress} persona={null} visible={true} />,
      );
      expect(queryByText('Automate something')).toBeNull();
      expect(queryByText("Let's chat first")).toBeNull();
      expect(queryByText('Surprise me')).toBeNull();
    });
  });

  describe('persona chips', () => {
    it('renders 4 chips when persona is "flame" (4th = "Automate something")', () => {
      const onChipPress = jest.fn();
      const { getByText } = render(
        <PromptChips onChipPress={onChipPress} persona="flame" visible={true} />,
      );
      expect(getByText("What's the weather like?")).toBeTruthy();
      expect(getByText('Track something for me')).toBeTruthy();
      expect(getByText('Help me organize my week')).toBeTruthy();
      expect(getByText('Automate something')).toBeTruthy();
    });

    it('renders 4 chips when persona is "tree" (4th = "Let\'s chat first")', () => {
      const onChipPress = jest.fn();
      const { getByText } = render(
        <PromptChips onChipPress={onChipPress} persona="tree" visible={true} />,
      );
      expect(getByText("Let's chat first")).toBeTruthy();
    });

    it('renders 4 chips when persona is "star" (4th = "Surprise me")', () => {
      const onChipPress = jest.fn();
      const { getByText } = render(
        <PromptChips onChipPress={onChipPress} persona="star" visible={true} />,
      );
      expect(getByText('Surprise me')).toBeTruthy();
    });

    it('persona chip has dashed border style', () => {
      const onChipPress = jest.fn();
      const { getByLabelText } = render(
        <PromptChips onChipPress={onChipPress} persona="flame" visible={true} />,
      );
      const personaChip = getByLabelText('Automate something');
      // The persona chip TouchableOpacity should have borderStyle: 'dashed'
      const chipStyle = personaChip.props.style;
      const flatStyle = Array.isArray(chipStyle)
        ? Object.assign({}, ...chipStyle.filter(Boolean))
        : chipStyle;
      expect(flatStyle).toEqual(expect.objectContaining({ borderStyle: 'dashed' }));
    });
  });

  describe('interaction', () => {
    it('tapping a chip calls onChipPress with chip text', () => {
      const onChipPress = jest.fn();
      const { getByText } = render(
        <PromptChips onChipPress={onChipPress} persona={null} visible={true} />,
      );
      fireEvent.press(getByText('Track something for me'));
      expect(onChipPress).toHaveBeenCalledWith('Track something for me');
    });

    it('tapping a persona chip calls onChipPress with persona chip text', () => {
      const onChipPress = jest.fn();
      const { getByText } = render(
        <PromptChips onChipPress={onChipPress} persona="star" visible={true} />,
      );
      fireEvent.press(getByText('Surprise me'));
      expect(onChipPress).toHaveBeenCalledWith('Surprise me');
    });
  });

  describe('touch target and accessibility', () => {
    it('chips meet minimum 44pt touch target height', () => {
      const onChipPress = jest.fn();
      const { getByLabelText } = render(
        <PromptChips onChipPress={onChipPress} persona={null} visible={true} />,
      );
      const chip = getByLabelText("What's the weather like?");
      const chipStyle = chip.props.style;
      const flatStyle = Array.isArray(chipStyle)
        ? Object.assign({}, ...chipStyle.filter(Boolean))
        : chipStyle;
      expect(flatStyle.minHeight).toBeGreaterThanOrEqual(44);
    });

    it('all chips have accessible labels', () => {
      const onChipPress = jest.fn();
      const { getByLabelText } = render(
        <PromptChips onChipPress={onChipPress} persona="flame" visible={true} />,
      );
      expect(getByLabelText("What's the weather like?")).toBeTruthy();
      expect(getByLabelText('Track something for me')).toBeTruthy();
      expect(getByLabelText('Help me organize my week')).toBeTruthy();
      expect(getByLabelText('Automate something')).toBeTruthy();
    });
  });
});
