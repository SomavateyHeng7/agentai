import { Mastra } from './framework';
import { contentGenerationWorkflow } from './workflows/content-generation.workflow';
import { salesQualificationWorkflow } from './workflows/sales-qualification.workflow';
import { salesforceMeetingOrchestrationWorkflow } from './workflows/salesforce-meeting-orchestration.workflow';
import { supportTriageWorkflow } from './workflows/support-triage.workflow';
import { postgresStore } from './store/postgres-store';

export const mastra = new Mastra();
let mastraInitPromise: Promise<void> | null = null;

mastra.registerWorkflow(salesQualificationWorkflow);
mastra.registerWorkflow(salesforceMeetingOrchestrationWorkflow);
mastra.registerWorkflow(supportTriageWorkflow);
mastra.registerWorkflow(contentGenerationWorkflow);

export const initializeMastra = async (): Promise<void> => {
  if (!mastraInitPromise) {
    mastraInitPromise = postgresStore.runMigrations();
  }

  await mastraInitPromise;
};
