/**
 * Edge case tests for PersonaSelector component (Story 2.3).
 *
 * Tests boundary conditions not covered by PersonaSelector.test.tsx:
 *   - Re-rendering with different personas
 *   - Rapid multiple taps
 *   - Tapping the already-active persona
 *   - Accessibility role and label structure
 *   - All persona descriptions present
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { PersonaSelector } from './PersonaSelector';
import type { PersonaType } from '@/types/ws';

describe('PersonaSelector edge cases', () => {
  const mockOnSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('re-render with persona change', () => {
    it('updates highlight when persona changes from flame to tree', () => {
      const { rerender, getByLabelText } = render(
        <PersonaSelector currentPersona="flame" onSelect={mockOnSelect} />,
      );

      // Flame is initially selected
      expect(
        getByLabelText('Select Flame persona').props.accessibilityState,
      ).toEqual({ selected: true });
      expect(
        getByLabelText('Select Tree persona').props.accessibilityState,
      ).toEqual({ selected: false });

      // Re-render with tree selected
      rerender(
        <PersonaSelector currentPersona="tree" onSelect={mockOnSelect} />,
      );

      expect(
        getByLabelText('Select Flame persona').props.accessibilityState,
      ).toEqual({ selected: false });
      expect(
        getByLabelText('Select Tree persona').props.accessibilityState,
      ).toEqual({ selected: true });
    });

    it('updates from persona to null (no selection)', () => {
      const { rerender, getByLabelText, queryByText, getByText } = render(
        <PersonaSelector currentPersona="star" onSelect={mockOnSelect} />,
      );

      // Star is selected, no hint shown
      expect(
        getByLabelText('Select Star persona').props.accessibilityState,
      ).toEqual({ selected: true });
      expect(queryByText('No persona selected')).toBeNull();

      // Re-render with null
      rerender(
        <PersonaSelector currentPersona={null} onSelect={mockOnSelect} />,
      );

      expect(
        getByLabelText('Select Star persona').props.accessibilityState,
      ).toEqual({ selected: false });
      expect(getByText('No persona selected')).toBeTruthy();
    });

    it('updates from null to persona hides hint', () => {
      const { rerender, queryByText, getByLabelText } = render(
        <PersonaSelector currentPersona={null} onSelect={mockOnSelect} />,
      );

      expect(queryByText('No persona selected')).toBeTruthy();

      rerender(
        <PersonaSelector currentPersona="flame" onSelect={mockOnSelect} />,
      );

      expect(queryByText('No persona selected')).toBeNull();
      expect(
        getByLabelText('Select Flame persona').props.accessibilityState,
      ).toEqual({ selected: true });
    });
  });

  describe('rapid interactions', () => {
    it('handles multiple rapid taps on different personas', () => {
      const { getByLabelText } = render(
        <PersonaSelector currentPersona={null} onSelect={mockOnSelect} />,
      );

      fireEvent.press(getByLabelText('Select Flame persona'));
      fireEvent.press(getByLabelText('Select Tree persona'));
      fireEvent.press(getByLabelText('Select Star persona'));

      expect(mockOnSelect).toHaveBeenCalledTimes(3);
      expect(mockOnSelect).toHaveBeenNthCalledWith(1, 'flame');
      expect(mockOnSelect).toHaveBeenNthCalledWith(2, 'tree');
      expect(mockOnSelect).toHaveBeenNthCalledWith(3, 'star');
    });

    it('handles double tap on same persona', () => {
      const { getByLabelText } = render(
        <PersonaSelector currentPersona="flame" onSelect={mockOnSelect} />,
      );

      fireEvent.press(getByLabelText('Select Flame persona'));
      fireEvent.press(getByLabelText('Select Flame persona'));

      expect(mockOnSelect).toHaveBeenCalledTimes(2);
      expect(mockOnSelect).toHaveBeenCalledWith('flame');
    });
  });

  describe('accessibility', () => {
    it('all cards have button role', () => {
      const { getByLabelText } = render(
        <PersonaSelector currentPersona={null} onSelect={mockOnSelect} />,
      );

      const personas: PersonaType[] = ['flame', 'tree', 'star'];
      for (const p of personas) {
        const name = p.charAt(0).toUpperCase() + p.slice(1);
        const card = getByLabelText(`Select ${name} persona`);
        expect(card.props.accessibilityRole).toBe('button');
      }
    });

    it('only one card is selected at a time', () => {
      const personas: PersonaType[] = ['flame', 'tree', 'star'];

      for (const activePerson of personas) {
        const { getByLabelText, unmount } = render(
          <PersonaSelector currentPersona={activePerson} onSelect={mockOnSelect} />,
        );

        let selectedCount = 0;
        for (const p of personas) {
          const name = p.charAt(0).toUpperCase() + p.slice(1);
          const card = getByLabelText(`Select ${name} persona`);
          if (card.props.accessibilityState?.selected) {
            selectedCount++;
          }
        }
        expect(selectedCount).toBe(1);
        unmount();
      }
    });

    it('no card is selected when currentPersona is null', () => {
      const { getByLabelText } = render(
        <PersonaSelector currentPersona={null} onSelect={mockOnSelect} />,
      );

      const personas: PersonaType[] = ['flame', 'tree', 'star'];
      for (const p of personas) {
        const name = p.charAt(0).toUpperCase() + p.slice(1);
        const card = getByLabelText(`Select ${name} persona`);
        expect(card.props.accessibilityState?.selected).toBe(false);
      }
    });
  });

  describe('content completeness', () => {
    it('renders exactly three cards', () => {
      const { getAllByRole } = render(
        <PersonaSelector currentPersona={null} onSelect={mockOnSelect} />,
      );

      const buttons = getAllByRole('button');
      expect(buttons).toHaveLength(3);
    });

    it('each persona has both name and description', () => {
      const { getByText } = render(
        <PersonaSelector currentPersona={null} onSelect={mockOnSelect} />,
      );

      // Names
      expect(getByText('Flame')).toBeTruthy();
      expect(getByText('Tree')).toBeTruthy();
      expect(getByText('Star')).toBeTruthy();

      // Descriptions
      expect(getByText('Autonomous, concise, acts first')).toBeTruthy();
      expect(getByText('Collaborative, warm, always asks')).toBeTruthy();
      expect(getByText('Balanced, adaptive autonomy')).toBeTruthy();
    });
  });
});
