'use client';

import type { Submission } from '@/lib/types';
import { SubmissionItem } from './submission-item';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Inbox } from 'lucide-react';

interface SubmissionListProps {
  submissions: Submission[];
  onRetry: (id: string) => void;
}

export function SubmissionList({ submissions, onRetry }: SubmissionListProps) {
  if (submissions.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center border-dashed py-12">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">Queue is Empty</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            No submissions yet. Fill out the form above to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {submissions.map((submission) => (
        <SubmissionItem
          key={submission.id}
          submission={submission}
          onRetry={onRetry}
        />
      ))}
    </div>
  );
}
