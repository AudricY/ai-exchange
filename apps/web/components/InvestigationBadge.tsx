import { Badge } from '@/components/ui/badge';

type InvestigationStatus = 'idle' | 'running' | 'completed' | 'failed';

interface InvestigationBadgeProps {
  status: InvestigationStatus;
  generatedAt?: string;
}

export function InvestigationBadge({ status, generatedAt }: InvestigationBadgeProps) {
  if (status === 'idle') {
    return null;
  }

  if (status === 'running') {
    return (
      <Badge variant="outline" className="border-yellow-500 text-yellow-400" title="Investigation in progress">
        <span className="inline-block animate-pulse mr-1">●</span>
        Investigating
      </Badge>
    );
  }

  if (status === 'failed') {
    return (
      <Badge variant="outline" className="border-red-500 text-red-400" title="Investigation failed">
        Failed
      </Badge>
    );
  }

  // completed
  const title = generatedAt
    ? `Investigated on ${new Date(generatedAt).toLocaleString()}`
    : 'Investigated';

  return (
    <Badge variant="outline" className="border-purple-500 text-purple-400" title={title}>
      Investigated
    </Badge>
  );
}
