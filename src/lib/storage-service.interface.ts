// src/lib/storage-service.interface.ts
import type { Submission } from './types';

export interface StorageService {
  init(): Promise<void>;
  getSubmissions(): Promise<Submission[]>;
  addOrUpdateSubmission(submission: Submission): Promise<void>;
  deleteSubmission(id: string): Promise<void>;
}
