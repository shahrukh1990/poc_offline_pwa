# **App Name**: OfflineForms

## Core Features:

- Form Creation and Submission: Allows users to fill out a form with various input types (text fields, dropdowns, optional file upload) and submit it.
- Client-Side Validation: Implements client-side validation to ensure data quality before submission, improving user experience and reducing server load.
- Offline Queue with SQLite: When the app is offline, form data is stored locally using @capacitor-community/sqlite, creating a persistent queue that survives app restarts.
- Automatic Background Synchronization: Detects network connectivity and automatically attempts to send queued forms to the server, with exponential backoff for retries.
- Submission Status UI: Provides a UI to display the submission status of each form (Pending, Sending, Sent, Failed), allowing manual retry for failed submissions and a view of the local queue.
- Network Connectivity Detection: Utilizes the Capacitor Network plugin (or navigator.onLine) to detect network connectivity and trigger synchronization upon reconnection.
- AI-Powered Data Correction Tool: A tool that, when invoked, uses an LLM to compare pending entries for a given form, in order to detect inconsistencies that could cause submission errors when back online. Based on the results of reasoning, the LLM can automatically propose suggested values.

## Style Guidelines:

- Primary color: Deep blue (#3F51B5) to convey trust and reliability in data handling.
- Background color: Light blue-gray (#ECEFF1) for a clean and unobtrusive backdrop.
- Accent color: A vivid orange (#FF9800) is used to highlight actions like form submission and retry.
- Body and headline font: 'Inter', a sans-serif font that maintains a modern and neutral look for both headlines and body text.
- Simple and clear icons to represent submission status (e.g., a clock for 'Pending', a checkmark for 'Sent', an error symbol for 'Failed').
- Clean, uncluttered layout with clear visual hierarchy to focus the user on the form and its submission status.
- Subtle animations (e.g., a loading spinner) to indicate background synchronization.