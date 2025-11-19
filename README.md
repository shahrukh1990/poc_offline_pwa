# OfflineForms - A Resilient, Offline-First React Application

This is a Next.js application designed to demonstrate a robust, offline-first approach for form submissions. It is built to be wrapped with [Capacitor](https://capacitorjs.com/) to create native iOS, Android, and Progressive Web Apps (PWA).

The application provides a simple form for users to submit maintenance requests. Its core feature is the ability to reliably queue submissions when the device is offline and automatically synchronize them with a remote server once connectivity is restored.

## Core Features

- **Offline-First Form Submission**: Forms can be filled out and submitted even without a network connection.
- **Persistent Queue**: Offline submissions are saved to a persistent local queue (using browser `localStorage` for this demo) that survives app restarts and device reboots.
- **Automatic Background Sync**: As soon as network connectivity is detected, the app automatically tries to send queued items to the server.
- **Exponential Backoff**: Failed sync attempts are retried with an increasing delay to avoid overwhelming the server and to gracefully handle transient network issues.
- **Status Dashboard**: The UI provides a clear, real-time status for each submission (Pending, Sending, Sent, Failed).
- **Manual Retry**: Users can manually trigger a retry for submissions that have failed after multiple automatic attempts.
- **AI-Powered Data Correction**: An integrated GenAI tool analyzes pending submissions for potential inconsistencies, suggesting corrections to improve data quality before synchronization.
- **Modern UI/UX**: Built with Next.js, TypeScript, Tailwind CSS, and ShadCN UI for a clean, responsive, and professional user experience.

## Technical Overview

### Offline Queue and Synchronization

The offline logic is managed by `OfflineQueueProvider` (`src/contexts/offline-queue-context.tsx`).

1.  **Submission**: When a user submits the form, the `addSubmission` function is called. It checks the network status via the `useNetworkStatus` hook.
2.  **Queueing**: If offline, the submission is immediately added to the local queue with a `pending` status. If online, it's also added as `pending`, and the synchronization process is triggered immediately.
3.  **Persistence**: The entire queue (an array of `Submission` objects) is persisted in the browser's `localStorage`. This ensures no data is lost if the user closes the app or reboots the device. For a native app, this would be replaced with a more robust solution like `@capacitor-community/sqlite`.
4.  **Synchronization (`syncQueue`)**:
    - The sync process runs whenever the app comes online or a manual retry is triggered.
    - It processes all items in the queue that are `pending` or `failed` (with fewer than max retries).
    - For each item, it makes a `POST` request to the server endpoint (`/api/submit`).
    - **On Success**: The item's status is updated to `sent`.
    - **On Failure**: The retry `attempts` count is incremented. If it's below the maximum limit, the next retry is scheduled using an exponential backoff algorithm (`delay = 1000 * 2^attempts`). If the max retry limit is reached, the status is changed to `failed`, and the app waits for a manual user action.

### Server Endpoint

The application includes a mock server endpoint at `src/app/api/submit/route.ts`. This endpoint simulates a real-world API:
- It accepts `POST` requests with JSON payloads.
- It randomly fails (with a 30% probability) to demonstrate the app's retry and error-handling capabilities.
- To use your own backend, modify the `fetch` URL in the `syncQueue` function within `src/contexts/offline-queue-context.tsx`.

### AI Data Correction

- Clicking "Analyze Pending Submissions" invokes a Genkit flow (`correctFormData`).
- It sends all `pending` and `failed` form entries to a Google Gemini model.
- The AI is prompted to act as a data validation assistant, analyzing the entries for inconsistencies (e.g., conflicting locations, unusual descriptions for an issue type).
- It returns structured proposals for corrections, which are then displayed to the user in a dialog for approval.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- npm or yarn

### Running Locally

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Run the development server**:
    ```bash
    npm run dev
    ```

3.  Open [http://localhost:9002](http://localhost:9002) in your browser.

To test the offline functionality, use your browser's developer tools to simulate being offline (e.g., in Chrome, go to the "Network" tab and check the "Offline" box).

## Capacitor Integration (PWA, iOS, Android)

This Next.js app is built to be compatible with Capacitor. To wrap it and build native versions, follow these steps:

1.  **Export the Static Site**:
    First, you need to configure Next.js for a static export. Modify `next.config.ts` to add `output: 'export'`.
    Then, run the build and export command:
    ```bash
    npm run build
    ```
    This will create a static version of your app in the `out/` directory.

2.  **Add Capacitor to the Project**:
    Follow the official Capacitor [installation guide](https://capacitorjs.com/docs/getting-started).
    ```bash
    npm install @capacitor/core @capacitor/cli
    npx cap init OfflineForms com.example.offlineforms --web-dir="out"
    ```

3.  **Add Native Platforms**:
    ```bash
    npm install @capacitor/ios @capacitor/android
    npx cap add ios
    npx cap add android
    ```

4.  **Install Required Plugins**:
    For the full native experience, install the recommended Capacitor plugins. For this app, you'd want Network and SQLite.
    ```bash
    npm install @capacitor/network
    npm install @capacitor-community/sqlite
    npx cap sync
    ```

5.  **Replacing `localStorage` with SQLite**:
    To use SQLite instead of `localStorage` for production, you would modify the persistence logic in `src/contexts/offline-queue-context.tsx` to use the `@capacitor-community/sqlite` APIs for database operations. This provides a more robust and performant storage solution for native devices.

6.  **Run on a Device**:
    Follow the Capacitor guides for [iOS](https://capacitorjs.com/docs/ios) and [Android](https://capacitorjs.com/docs/android) to build, run, and deploy your application on native devices.
