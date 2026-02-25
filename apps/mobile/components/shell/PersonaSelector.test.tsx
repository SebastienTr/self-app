/**
 * Tests for PersonaSelector component (Story 2.3, AC: #8).
 *
 * Tests:
 *   - Renders three persona options
 *   - Highlights the active persona with accessibility state
 *   - Tapping a persona calls onSelect with the correct type
 *   - Shows "No persona selected" hint when persona is null
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { PersonaSelector } from './PersonaSelector';
import type { PersonaType } from '@/types/ws';

describe('PersonaSelector', () => {
  const mockOnSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders three persona options', () => {
      const { getByLabelText } = render(
        <PersonaSelector currentPersona={null} onSelect={mockOnSelect} />,
      );
      expect(getByLabelText('Select Flame persona')).toBeTruthy();
      expect(getByLabelText('Select Tree persona')).toBeTruthy();
      expect(getByLabelText('Select Star persona')).toBeTruthy();
    });

    it('renders persona names', () => {
      const { getByText } = render(
        <PersonaSelector currentPersona={null} onSelect={mockOnSelect} />,
      );
      expect(getByText('Flame')).toBeTruthy();
      expect(getByText('Tree')).toBeTruthy();
      expect(getByText('Star')).toBeTruthy();
    });

    it('renders persona descriptions', () => {
      const { getByText } = render(
        <PersonaSelector currentPersona={null} onSelect={mockOnSelect} />,
      );
      expect(getByText('Autonomous, concise, acts first')).toBeTruthy();
      expect(getByText('Collaborative, warm, always asks')).toBeTruthy();
      expect(getByText('Balanced, adaptive autonomy')).toBeTruthy();
    });

    it('shows "No persona selected" when persona is null', () => {
      const { getByText } = render(
        <PersonaSelector currentPersona={null} onSelect={mockOnSelect} />,
      );
      expect(getByText('No persona selected')).toBeTruthy();
    });

    it('does not show "No persona selected" when a persona is active', () => {
      const { queryByText } = render(
        <PersonaSelector currentPersona="flame" onSelect={mockOnSelect} />,
      );
      expect(queryByText('No persona selected')).toBeNull();
    });
  });

  describe('active persona highlighting', () => {
    it('marks flame as selected when currentPersona is flame', () => {
      const { getByLabelText } = render(
        <PersonaSelector currentPersona="flame" onSelect={mockOnSelect} />,
      );
      const flameCard = getByLabelText('Select Flame persona');
      expect(flameCard.props.accessibilityState).toEqual({ selected: true });
    });

    it('marks tree as not selected when currentPersona is flame', () => {
      const { getByLabelText } = render(
        <PersonaSelector currentPersona="flame" onSelect={mockOnSelect} />,
      );
      const treeCard = getByLabelText('Select Tree persona');
      expect(treeCard.props.accessibilityState).toEqual({ selected: false });
    });

    it('marks tree as selected when currentPersona is tree', () => {
      const { getByLabelText } = render(
        <PersonaSelector currentPersona="tree" onSelect={mockOnSelect} />,
      );
      const treeCard = getByLabelText('Select Tree persona');
      expect(treeCard.props.accessibilityState).toEqual({ selected: true });
    });

    it('marks star as selected when currentPersona is star', () => {
      const { getByLabelText } = render(
        <PersonaSelector currentPersona="star" onSelect={mockOnSelect} />,
      );
      const starCard = getByLabelText('Select Star persona');
      expect(starCard.props.accessibilityState).toEqual({ selected: true });
    });

    it('no persona is marked selected when currentPersona is null', () => {
      const { getByLabelText } = render(
        <PersonaSelector currentPersona={null} onSelect={mockOnSelect} />,
      );
      const personas: PersonaType[] = ['flame', 'tree', 'star'];
      for (const p of personas) {
        const name = p.charAt(0).toUpperCase() + p.slice(1);
        const card = getByLabelText(`Select ${name} persona`);
        expect(card.props.accessibilityState).toEqual({ selected: false });
      }
    });
  });

  describe('interaction', () => {
    it('calls onSelect with flame when Flame is tapped', () => {
      const { getByLabelText } = render(
        <PersonaSelector currentPersona={null} onSelect={mockOnSelect} />,
      );
      fireEvent.press(getByLabelText('Select Flame persona'));
      expect(mockOnSelect).toHaveBeenCalledWith('flame');
      expect(mockOnSelect).toHaveBeenCalledTimes(1);
    });

    it('calls onSelect with tree when Tree is tapped', () => {
      const { getByLabelText } = render(
        <PersonaSelector currentPersona={null} onSelect={mockOnSelect} />,
      );
      fireEvent.press(getByLabelText('Select Tree persona'));
      expect(mockOnSelect).toHaveBeenCalledWith('tree');
    });

    it('calls onSelect with star when Star is tapped', () => {
      const { getByLabelText } = render(
        <PersonaSelector currentPersona={null} onSelect={mockOnSelect} />,
      );
      fireEvent.press(getByLabelText('Select Star persona'));
      expect(mockOnSelect).toHaveBeenCalledWith('star');
    });

    it('calls onSelect even when tapping the currently active persona', () => {
      const { getByLabelText } = render(
        <PersonaSelector currentPersona="flame" onSelect={mockOnSelect} />,
      );
      fireEvent.press(getByLabelText('Select Flame persona'));
      expect(mockOnSelect).toHaveBeenCalledWith('flame');
    });
  });
});
