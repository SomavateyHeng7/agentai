interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorState = ({ message, onRetry }: ErrorStateProps) => (
  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
    <p>{message}</p>
    {onRetry ? (
      <button className="mt-2 rounded-md bg-rose-700 px-3 py-1 text-xs text-white" onClick={onRetry}>
        Retry
      </button>
    ) : null}
  </div>
);
