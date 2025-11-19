// src/lib/local-storage-service.ts
import type { Submission } from './types';
import type { StorageService } from './storage-service.interface';

const QUEUE_STORAGE_KEY = 'submissionQueue';

let submissions: Submission[] = [];

function init(): Promise<void> {
  try {
    const storedQueue = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (storedQueue) {
      submissions = JSON.parse(storedQueue);
    }
  } catch (error) {
    console.error('Failed to load submission queue from localStorage:', error);
    submissions = [];
  }
  return Promise.resolve();
}

function getSubmissions(): Promise<Submission[]> {
  return Promise.resolve(submissions);
}

function persist() {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(submissions));
  } catch (error) {
    console.error('Failed to save submission queue to localStorage:', error);
  }
}

function addOrUpdateSubmission(submission: Submission): Promise<void> {
  const index = submissions.findIndex(s => s.id === submission.id);
  if (index > -1) {
    submissions[index] = submission;
  } else {
    // Add to the beginning of the array
    submissions.unshift(submission);
  }
  persist();
  return Promise.resolve();
}

function deleteSubmission(id: string): Promise<void> {
  submissions = submissions.filter(s => s.id !== id);
  persist();
  return Promise.resolve();
}

export { init, getSubmissions, addOrUpdateSubmission, deleteSubmission };
