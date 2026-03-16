interface Props {
  variant?: 'table' | 'cards' | 'list' | 'form';
  rows?: number;
}

function ShimmerBar({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className || 'h-4 w-full'}`} />;
}

export default function LoadingSkeleton({ variant = 'cards', rows = 4 }: Props) {
  if (variant === 'table') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <ShimmerBar className="h-5 w-48" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <ShimmerBar className="h-4 w-1/4" />
            <ShimmerBar className="h-4 w-1/3" />
            <ShimmerBar className="h-4 w-1/5" />
            <ShimmerBar className="h-4 w-1/6" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'form') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 max-w-lg">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-2">
            <ShimmerBar className="h-3 w-24" />
            <ShimmerBar className="h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
            <ShimmerBar className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <ShimmerBar className="h-4 w-1/3" />
              <ShimmerBar className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // cards (default)
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <ShimmerBar className="h-5 w-2/3" />
          <ShimmerBar className="h-4 w-full" />
          <ShimmerBar className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}
