import { Router } from 'express';

interface SettingsState {
  apiKeys: {
    anthropic: string;
  };
  integrations: {
    salesforceInstanceUrl: string;
    zendeskSubdomain: string;
    meetingBaseUrl: string;
  };
  notifications: {
    email: boolean;
    slack: boolean;
  };
  deployment: {
    defaultEnv: 'staging' | 'production';
  };
  database: {
    url: string;
  };
}

const state: SettingsState = {
  apiKeys: {
    anthropic: process.env.ANTHROPIC_API_KEY ? '***configured***' : 'not-configured',
  },
  integrations: {
    salesforceInstanceUrl: process.env.SALESFORCE_INSTANCE_URL || 'https://mock.salesforce.com',
    zendeskSubdomain: process.env.ZENDESK_SUBDOMAIN || 'mock-company',
    meetingBaseUrl: process.env.MEETING_BASE_URL || 'https://mock-meetings.example.com',
  },
  notifications: {
    email: true,
    slack: true,
  },
  deployment: {
    defaultEnv: 'staging',
  },
  database: {
    url: process.env.DATABASE_URL || 'in-memory',
  },
};

export const settingsRouter = Router();

settingsRouter.get('/', (_req, res) => {
  res.json({ success: true, data: state });
});

settingsRouter.put('/', (req, res) => {
  const update = req.body as Partial<SettingsState>;

  if (update.notifications) {
    state.notifications = {
      ...state.notifications,
      ...update.notifications,
    };
  }

  if (update.deployment) {
    state.deployment = {
      ...state.deployment,
      ...update.deployment,
    };
  }

  if (update.integrations) {
    state.integrations = {
      ...state.integrations,
      ...update.integrations,
    };
  }

  res.json({ success: true, data: state });
});
