export type SubmissionStatus = 'pending' | 'sending' | 'sent' | 'failed';

export type IssueType = 'plumbing' | 'electrical' | 'structural' | 'other';

export const issueTypes: IssueType[] = [
  'plumbing',
  'electrical',
  'structural',
  'other',
];

export interface MaintenanceRequest {
  location: string;
  issueType: IssueType;
  description: string;
}

export interface Submission {
  id: string;
  formData: MaintenanceRequest;
  status: SubmissionStatus;
  attempts: number;
  timestamp: number;
  nextAttemptAt?: number;
}
