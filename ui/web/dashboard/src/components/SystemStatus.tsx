import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export const SystemStatus = () => {
  const { data } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await api.get('/health');
      return response.data;
    },
    refetchInterval: 5000,
  });

  const status = data?.status || 'offline';
  const dotClass =
    status === 'ok' ? 'bg-emerald-500' : status === 'degraded' ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-3 py-1 text-sm">
      <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
      <span className="capitalize">{status}</span>
    </div>
  );
};
