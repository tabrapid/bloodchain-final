import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SearchInput } from './SearchInput';

/**
 * P3-16. The clear button is conditional on *both* a non-empty value and an
 * `onClear` handler, which is easy to get wrong in either direction, and it
 * carried no accessible name at all — a screen reader announced an unlabelled
 * button next to the field.
 */
describe('SearchInput', () => {
  it('forwards value and change events like a normal input', async () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} placeholder="Find a donor" />);

    await userEvent.type(screen.getByPlaceholderText('Find a donor'), 'ab');

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('hides the clear button when the field is empty', () => {
    render(<SearchInput value="" onChange={vi.fn()} onClear={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });

  it('hides the clear button when there is no handler to clear with', () => {
    render(<SearchInput value="O-negative" onChange={vi.fn()} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows a labelled clear button once there is something to clear', async () => {
    const onClear = vi.fn();
    render(<SearchInput value="O-negative" onChange={vi.fn()} onClear={onClear} />);

    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('does not submit a surrounding form when cleared', async () => {
    // type="button": without it the clear control would submit any form it
    // sits inside, which is how a filter bar usually renders.
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <SearchInput value="x" onChange={vi.fn()} onClear={vi.fn()} />
      </form>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
