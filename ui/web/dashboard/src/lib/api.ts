import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL,
  timeout: 15000,
});

export const fetchDashboard = async () => {
  const { data } = await api.get('/api/dashboard');
  return data;
};

export const fetchAgentMetrics = async (agentName: string) => {
  const { data } = await api.get(`/api/metrics/${agentName}`);
  return data;
};

export const fetchWorkflowExecutions = async () => {
  const { data } = await api.get('/api/workflows/executions');
  return data;
};

export const executeWorkflow = async (payload: unknown) => {
  const { data } = await api.post('/api/workflows/execute', payload);
  return data;
};

export const fetchPathMetrics = async () => {
  const { data } = await api.get('/api/workflows/metrics/paths');
  return data;
};

export const listABTests = async () => {
  const { data } = await api.get('/api/ab-tests');
  return data;
};
