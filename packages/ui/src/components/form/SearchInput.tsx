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
        'flex items-center gap-2 rounded-lg border border-[#253442] bg-[#111A24] px-3 py-2 focus-within:border-[#68B7D1]',
        wrapperClassName,
      )}
    >
      <Search size={16} className="text-[#8495A3]" />
      <input
        type="text"
        className={cn(
          'flex-1 bg-transparent text-sm text-[#F2F5F7] placeholder:text-[#8495A3] focus:outline-none',
          className,
        )}
        {...props}
      />
      {props.value && onClear && (
        <button type="button" onClick={onClear} className="text-[#8495A3] hover:text-[#F2F5F7]">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
