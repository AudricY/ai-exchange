import { Badge } from '@/components/ui/badge';

interface InvestigationBadgeProps {
  hasReport: boolean;
  generatedAt?: string;
}

export function InvestigationBadge({ hasReport, generatedAt }: InvestigationBadgeProps) {
  if (!hasReport) {
    return null;
  }

  const title = generatedAt
    ? `Investigated on ${new Date(generatedAt).toLocaleString()}`
    : 'Investigated';

  return (
    <Badge variant="outline" className="border-purple-500 text-purple-400" title={title}>
      Investigated
    </Badge>
  );
}
