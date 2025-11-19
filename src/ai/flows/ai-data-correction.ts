// src/ai/flows/ai-data-correction.ts
'use server';

/**
 * @fileOverview Provides a Genkit flow for AI-powered data correction, which analyzes pending form entries for inconsistencies and suggests corrected values.
 *
 * - correctFormData - Analyzes form data entries and suggests corrections.
 * - CorrectFormDataInput - The input type for the correctFormData function.
 * - CorrectFormDataOutput - The return type for the correctFormData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CorrectFormDataInputSchema = z.object({
  formName: z.string().describe('The name of the form to analyze.'),
  formDataEntries: z.array(z.record(z.any())).describe('An array of form data entries to analyze for inconsistencies.'),
});
export type CorrectFormDataInput = z.infer<typeof CorrectFormDataInputSchema>;

const CorrectFormDataOutputSchema = z.object({
  correctedDataProposals: z.array(
    z.object({
      entryIndex: z.number().describe('Index of the entry with suggested corrections.'),
      field: z.string().describe('The field name with suggested correction.'),
      suggestedValue: z.any().describe('The suggested corrected value for the field.'),
      reasoning: z.string().describe('The reasoning behind the suggested correction.'),
    })
  ).describe('An array of suggested data corrections for inconsistent fields across form entries.'),
});
export type CorrectFormDataOutput = z.infer<typeof CorrectFormDataOutputSchema>;

export async function correctFormData(input: CorrectFormDataInput): Promise<CorrectFormDataOutput> {
  return correctFormDataFlow(input);
}

const correctFormDataPrompt = ai.definePrompt({
  name: 'correctFormDataPrompt',
  input: {schema: CorrectFormDataInputSchema},
  output: {schema: CorrectFormDataOutputSchema},
  prompt: `You are an AI assistant designed to analyze form data and identify inconsistencies that could cause submission errors.

You are given a list of form data entries for the form "{{formName}}". Your task is to compare these entries and suggest corrected values for fields where discrepancies are found.

Provide your output as a JSON array of correctedDataProposals objects. Each object should include the entryIndex, field, suggestedValue, and reasoning behind the suggestion.

Here are the form data entries:
{{#each formDataEntries}}
Entry {{@index}}:
{{#each this}}
  {{@key}}: {{this}}
{{/each}}
{{/each}}
`,
});

const correctFormDataFlow = ai.defineFlow(
  {
    name: 'correctFormDataFlow',
    inputSchema: CorrectFormDataInputSchema,
    outputSchema: CorrectFormDataOutputSchema,
  },
  async input => {
    const {output} = await correctFormDataPrompt(input);
    return output!;
  }
);
