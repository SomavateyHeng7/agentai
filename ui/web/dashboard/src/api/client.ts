import { api } from '../lib/api';

export class AgentFlowAPI {
  async getAgents(): Promise<unknown> {
    const dashboard = (await this.getDashboard()) as { data?: { byAgent?: unknown } };
    return dashboard.data?.byAgent || {};
  }

  async getDashboard(): Promise<unknown> {
    const { data } = await api.get('/api/dashboard');
    return data;
  }

  async getAgentMetrics(agentId: string): Promise<unknown> {
    const { data } = await api.get(`/api/metrics/${agentId}`);
    return data;
  }

  async executeAgent(agentId: string, input: unknown): Promise<unknown> {
    const mapping: Record<string, string> = {
      'sales-qualify': '/api/agents/sales/qualify',
      'sales-orchestrate': '/api/agents/sales/orchestrate',
      'support-triage': '/api/agents/support/triage',
      'content-generate': '/api/agents/content/generate',
    };

    const route = mapping[agentId];
    if (!route) {
      throw new Error(`Unsupported agent id: ${agentId}`);
    }

    const { data } = await api.post(route, input);
    return data;
  }

  async getWorkflows(): Promise<unknown> {
    const { data } = await api.get('/api/workflows/executions');
    return data;
  }

  async executeWorkflow(input: unknown): Promise<unknown> {
    const { data } = await api.post('/api/workflows/execute', input);
    return data;
  }

  async getWorkflowPathMetrics(): Promise<unknown> {
    const { data } = await api.get('/api/workflows/metrics/paths');
    return data;
  }

  async getABTests(): Promise<unknown> {
    const { data } = await api.get('/api/ab-tests');
    return data;
  }

  async createABTest(config: unknown): Promise<unknown> {
    const { data } = await api.post('/api/ab-tests', config);
    return data;
  }

  async getABTest(testId: string): Promise<unknown> {
    const { data } = await api.get(`/api/ab-tests/${testId}`);
    return data;
  }

  async promoteABWinner(testId: string, winner: 'A' | 'B'): Promise<unknown> {
    const { data } = await api.post(`/api/ab-tests/${testId}/promote`, { winner });
    return data;
  }

  async getMonitoringResources(): Promise<unknown> {
    const { data } = await api.get('/api/monitoring/resources');
    return data;
  }

  async getAlertRules(): Promise<unknown> {
    const { data } = await api.get('/api/monitoring/alerts');
    return data;
  }

  async updateAlertRule(id: string, payload: unknown): Promise<unknown> {
    const { data } = await api.put(`/api/monitoring/alerts/${id}`, payload);
    return data;
  }

  async getSettings(): Promise<unknown> {
    const { data } = await api.get('/api/settings');
    return data;
  }

  async updateSettings(payload: unknown): Promise<unknown> {
    const { data } = await api.put('/api/settings', payload);
    return data;
  }
}

export const agentFlowAPI = new AgentFlowAPI();
