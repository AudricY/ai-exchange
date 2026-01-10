import { Badge } from '@/components/ui/badge';

interface InvestigationBadgeProps {
  count: number;
  isRunning: boolean;
  latestAt?: string;
}

export function InvestigationBadge({ count, isRunning, latestAt }: InvestigationBadgeProps) {
  if (count === 0 && !isRunning) {
    return null;
  }

  if (isRunning) {
    return (
      <Badge variant="outline" className="border-yellow-500 text-yellow-400" title="Investigation in progress">
        <span className="inline-block animate-pulse mr-1">●</span>
        Investigating
      </Badge>
    );
  }

  const title = latestAt
    ? `${count} investigation${count > 1 ? 's' : ''} - Latest: ${new Date(latestAt).toLocaleString()}`
    : `${count} investigation${count > 1 ? 's' : ''}`;

  return (
    <Badge variant="outline" className="border-purple-500 text-purple-400" title={title}>
      {count} Investigation{count > 1 ? 's' : ''}
    </Badge>
  );
}
