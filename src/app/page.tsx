'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertCircle,
  BrainCircuit,
  Cloud,
  CloudOff,
  FileText,
} from 'lucide-react';
import { MaintenanceForm } from '@/components/maintenance-form';
import { SubmissionList } from '@/components/submission-list';
import { AiCorrectionsDialog } from '@/components/ai-corrections-dialog';
import { useOfflineQueue } from '@/contexts/offline-queue-context';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Submission } from '@/lib/types';
import { correctFormData } from '@/ai/flows/ai-data-correction';
import { Skeleton } from '@/components/ui/skeleton';

const DatabaseProvider = dynamic(
  () => import('@/components/database-provider'),
  {
    ssr: false,
    loading: () => (
       <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    ),
  }
);


export default function Home() {
  const { submissions, retrySubmission, updateSubmissionData, isDbInitialized } =
    useOfflineQueue();
  const isOnline = useNetworkStatus();
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [aiProposals, setAiProposals] = useState<any[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [pendingItemsForAI, setPendingItemsForAI] = useState<Submission[]>([]);

  const handleAnalyze = async () => {
    const pendingItems = submissions.filter(
      (s) => s.status === 'pending' || s.status === 'failed'
    );
    if (pendingItems.length === 0) return;

    setPendingItemsForAI(pendingItems);
    setIsAiDialogOpen(true);
    setIsAiLoading(true);

    try {
      const formDataEntries = pendingItems.map((item) => item.formData);
      const result = await correctFormData({
        formName: 'Maintenance Report',
        formDataEntries,
      });

      if (result.correctedDataProposals) {
        setAiProposals(result.correctedDataProposals);
      }
    } catch (error) {
      console.error('AI analysis failed:', error);
      // Here you could use a toast to notify the user of the error
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAcceptCorrection = (
    proposalIndex: number,
    field: string,
    suggestedValue: any
  ) => {
    const originalItemIndex = aiProposals[proposalIndex].entryIndex;
    const itemToUpdate = pendingItemsForAI[originalItemIndex];

    if (itemToUpdate) {
      const updatedFormData = {
        ...itemToUpdate.formData,
        [field]: suggestedValue,
      };
      updateSubmissionData(itemToUpdate.id, updatedFormData);
    }
    setAiProposals((prev) => prev.filter((_, idx) => idx !== proposalIndex));
  };

  const handleDialogClose = () => {
    setIsAiDialogOpen(false);
    setAiProposals([]);
  };

  const pendingCount = submissions.filter(
    (s) => s.status === 'pending' || s.status === 'failed'
  ).length;

  return (
     <DatabaseProvider>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 w-full border-b bg-card shadow-sm">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <FileText className="h-7 w-7 text-primary" />
              <h1 className="font-headline text-xl font-bold text-foreground">
                OfflineForms
              </h1>
            </div>
            <Badge
              variant={isOnline ? 'secondary' : 'destructive'}
              className="flex items-center gap-2"
            >
              {isOnline ? (
                <Cloud className="h-4 w-4" />
              ) : (
                <CloudOff className="h-4 w-4" />
              )}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </Badge>
          </div>
        </header>

        <main className="container mx-auto p-4 md:p-8">
         {!isDbInitialized ? (
             <div className="mx-auto max-w-3xl space-y-8">
              <Skeleton className="h-96 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-8">
              <MaintenanceForm />
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h2 className="font-headline text-2xl font-semibold">
                    Submission Queue
                  </h2>
                  <Button
                    onClick={handleAnalyze}
                    disabled={pendingCount === 0 || isAiLoading}
                    variant="outline"
                  >
                    <BrainCircuit className="mr-2 h-4 w-4" />
                    Analyze Pending ({pendingCount})
                  </Button>
                </div>
                <SubmissionList
                  submissions={submissions}
                  onRetry={retrySubmission}
                />
              </div>
            </div>
           )}
        </main>

        <AiCorrectionsDialog
          open={isAiDialogOpen}
          onOpenChange={handleDialogClose}
          proposals={aiProposals}
          isLoading={isAiLoading}
          onAccept={handleAcceptCorrection}
          originalItems={pendingItemsForAI}
        />
      </div>
    </DatabaseProvider>
  );
}
