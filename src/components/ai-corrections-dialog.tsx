'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, BrainCircuit, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Submission } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';

interface AiCorrectionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposals: any[];
  isLoading: boolean;
  onAccept: (proposalIndex: number, field: string, value: any) => void;
  originalItems: Submission[];
}

export function AiCorrectionsDialog({
  open,
  onOpenChange,
  proposals,
  isLoading,
  onAccept,
  originalItems,
}: AiCorrectionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BrainCircuit className="h-6 w-6 text-primary" />
            AI Data Correction Analysis
          </DialogTitle>
          <DialogDescription>
            Our AI has analyzed pending submissions for potential errors. Review
            the suggestions below.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-6">
          <div className="py-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center space-y-4 py-16">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground">
                  Analyzing submissions...
                </p>
              </div>
            ) : proposals.length > 0 ? (
              <div className="space-y-4">
                {proposals.map((proposal, index) => {
                  const originalItem = originalItems[proposal.entryIndex];
                  if (!originalItem) return null;
                  const originalValue = originalItem.formData[proposal.field as keyof typeof originalItem.formData];

                  return (
                    <Card key={index} className="bg-secondary/50">
                      <CardHeader>
                        <CardTitle className="text-base">
                          Suggestion for "{originalItem.formData.location}"
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-sm">
                          <p className="font-bold">Field:</p>
                          <Badge variant="outline" className='capitalize'>{proposal.field}</Badge>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                           <div className="text-sm rounded-md border border-destructive/50 bg-background p-3">
                              <p className="font-bold text-destructive">Original Value:</p>
                              <p className="line-through">{String(originalValue)}</p>
                          </div>
                          <div className="text-sm rounded-md border border-green-500/50 bg-background p-3">
                              <p className="font-bold text-green-600">Suggested Value:</p>
                              <p>{String(proposal.suggestedValue)}</p>
                          </div>
                        </div>

                        <div className="text-sm">
                          <p className="font-bold">Reasoning:</p>
                          <p className="italic text-muted-foreground">
                            "{proposal.reasoning}"
                          </p>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                          >
                            <X className="mr-2 h-4 w-4" /> Reject
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() =>
                              onAccept(
                                index,
                                proposal.field,
                                proposal.suggestedValue
                              )
                            }
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Accept
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-4 py-16">
                <Check className="h-12 w-12 text-green-500" />
                <p className="text-center text-muted-foreground">
                  No inconsistencies found. Everything looks good!
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
