import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ComponentBarcode } from './ComponentBarcode';
describe('component barcode', () => {
  it('renders real Code128 bars and updates when a different component is selected', () => {
    const { container, rerender } = render(<ComponentBarcode reference="BC-UNIT-001" />);
    expect(container.querySelectorAll('svg rect').length).toBeGreaterThan(10);
    expect(screen.getByText('BC-UNIT-001')).toBeInTheDocument();
    const original = container.querySelector('svg')?.innerHTML;
    rerender(<ComponentBarcode reference="BC-UNIT-002" />);
    expect(container.querySelector('svg')?.innerHTML).not.toEqual(original);
    expect(screen.getByText('BC-UNIT-002')).toBeInTheDocument();
  });
});

it('hides an unencodable label and recovers when a valid reference is supplied', () => {
  const { container, rerender } = render(<ComponentBarcode reference="🩸" />);
  expect(container.querySelector('svg')).not.toBeVisible();
  rerender(<ComponentBarcode reference="BC-UNIT-003" />);
  expect(container.querySelector('svg')).toBeVisible();
  expect(container.querySelectorAll('svg rect').length).toBeGreaterThan(10);
});
