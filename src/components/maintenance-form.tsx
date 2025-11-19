'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useOfflineQueue } from '@/contexts/offline-queue-context';
import type { IssueType } from '@/lib/types';
import { issueTypes } from '@/lib/types';
import { useNetworkStatus } from '@/hooks/use-network-status';

const formSchema = z.object({
  location: z.string().min(3, 'Location must be at least 3 characters long.'),
  issueType: z.enum(issueTypes, {
    errorMap: () => ({ message: 'Please select a valid issue type.' }),
  }),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters long.'),
});

type FormData = z.infer<typeof formSchema>;

export function MaintenanceForm() {
  const { addSubmission } = useOfflineQueue();
  const isOnline = useNetworkStatus();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      location: '',
      issueType: undefined,
      description: '',
    },
  });

  const onSubmit = (data: FormData) => {
    addSubmission(data);
    form.reset();
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Report a Maintenance Issue</CardTitle>
        <CardDescription>
          Fill out the form below. If you're offline, your report will be saved
          and sent later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Office 204, Kitchen" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="issueType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issue Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an issue type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {issueTypes.map((type) => (
                        <SelectItem key={type} value={type} className="capitalize">
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the issue in detail..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              style={{
                backgroundColor: 'hsl(var(--accent))',
                color: 'hsl(var(--accent-foreground))',
              }}
            >
              <Send className="mr-2 h-4 w-4" />
              {isOnline ? 'Submit Report' : 'Queue for Submission'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
