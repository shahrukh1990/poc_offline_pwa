'use client';

import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Submission } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface SubmissionItemProps {
  submission: Submission;
  onRetry: (id: string) => void;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'bg-yellow-500',
    text: 'Pending',
  },
  sending: {
    icon: Loader2,
    color: 'bg-blue-500 animate-spin',
    text: 'Sending',
  },
  sent: {
    icon: CheckCircle2,
    color: 'bg-green-500',
    text: 'Sent',
  },
  failed: {
    icon: XCircle,
    color: 'bg-red-500',
    text: 'Failed',
  },
};

export function SubmissionItem({ submission, onRetry }: SubmissionItemProps) {
  const { formData, status, timestamp } = submission;
  const { icon: Icon, color, text } = statusConfig[status];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-lg font-medium capitalize">
            {formData.issueType} Issue
          </CardTitle>
          <Badge variant={status === 'failed' ? 'destructive' : 'secondary'}>
            <Icon
              className={`mr-2 h-4 w-4 ${
                status === 'sending' ? 'animate-spin' : ''
              }`}
            />
            {text}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="font-semibold text-muted-foreground">Location</p>
          <p className="text-foreground">{formData.location}</p>
        </div>
        <div>
          <p className="font-semibold text-muted-foreground">Description</p>
          <p className="text-foreground">{formData.description}</p>
        </div>
      </CardContent>
      <Separator />
      <CardFooter className="flex items-center justify-between p-4 text-xs text-muted-foreground">
        <span>
          {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
        </span>
        {status === 'failed' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRetry(submission.id)}
          >
            <RefreshCw className="mr-2 h-3 w-3" />
            Retry
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
