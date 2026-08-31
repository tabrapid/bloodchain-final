import { Search, X } from 'lucide-react';
import { cn } from '../cn';

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
  wrapperClassName?: string;
}

export function SearchInput({ className, onClear, wrapperClassName, ...props }: SearchInputProps) {
  return (
    <div
      className={cn(
        // Solid, not glass: an input the user is about to type into needs a
        // stable, opaque field, not scrolled content showing through it.
        'bc-solid flex items-center gap-2 rounded-lg px-3 py-2 transition-colors focus-within:border-donor-secondary focus-within:ring-2 focus-within:ring-donor-secondary/30',
        wrapperClassName,
      )}
    >
      <Search size={16} className="text-donor-muted" />
      <input
        type="text"
        className={cn(
          'flex-1 bg-transparent text-sm text-donor-text placeholder:text-donor-muted focus:outline-none',
          className,
        )}
        {...props}
      />
      {props.value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="text-donor-muted hover:text-donor-text"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
