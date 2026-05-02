interface SubmitButtonProps {
  isLoading: boolean;
  label: string;
  loadingLabel?: string;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
  type?: 'submit' | 'button';
}

export const SubmitButton = ({
  isLoading,
  label,
  loadingLabel = 'Saving...',
  disabled = false,
  className = '',
  onClick,
  type = 'submit',
}: SubmitButtonProps) => (
  <button
    type={type}
    onClick={onClick}
    disabled={isLoading || disabled}
    className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg transition-all ${(isLoading || disabled) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'} ${className}`}
  >
    {isLoading ? (
      <span className="flex items-center gap-2">
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        {loadingLabel}
      </span>
    ) : (
      label
    )}
  </button>
);
