import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { agentFlowAPI } from '../api/client';

interface SettingsData {
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
  apiKeys: {
    anthropic: string;
  };
}

export const SettingsPage = () => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SettingsData | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => agentFlowAPI.getSettings(),
  });

  useEffect(() => {
    const parsed = (settingsQuery.data as { data?: SettingsData } | undefined)?.data;
    if (parsed) {
      setDraft(parsed);
    }
  }, [settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: unknown) => agentFlowAPI.updateSettings(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  const onSave = (event: FormEvent) => {
    event.preventDefault();
    if (!draft) {
      return;
    }

    updateMutation.mutate({
      integrations: draft.integrations,
      notifications: draft.notifications,
      deployment: draft.deployment,
    });
  };

  if (!draft && settingsQuery.isLoading) {
    return <p className="text-sm">Loading settings...</p>;
  }

  if (!draft) {
    return <p className="text-sm text-rose-600">Failed to load settings.</p>;
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-ink/60">API keys, integrations, notification preferences, and deployment defaults.</p>
      </header>

      <form className="space-y-4 rounded-2xl border border-ink/10 bg-white p-4" onSubmit={onSave}>
        <section className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Salesforce Instance URL
            <input
              className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2"
              value={draft.integrations.salesforceInstanceUrl}
              onChange={(event) =>
                setDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        integrations: {
                          ...prev.integrations,
                          salesforceInstanceUrl: event.target.value,
                        },
                      }
                    : prev
                )
              }
            />
          </label>

          <label className="text-sm">
            Zendesk Subdomain
            <input
              className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2"
              value={draft.integrations.zendeskSubdomain}
              onChange={(event) =>
                setDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        integrations: {
                          ...prev.integrations,
                          zendeskSubdomain: event.target.value,
                        },
                      }
                    : prev
                )
              }
            />
          </label>

          <label className="text-sm">
            Meeting Base URL
            <input
              className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2"
              value={draft.integrations.meetingBaseUrl}
              onChange={(event) =>
                setDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        integrations: {
                          ...prev.integrations,
                          meetingBaseUrl: event.target.value,
                        },
                      }
                    : prev
                )
              }
            />
          </label>

          <label className="text-sm">
            Default Deploy Environment
            <select
              className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2"
              value={draft.deployment.defaultEnv}
              onChange={(event) =>
                setDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        deployment: {
                          ...prev.deployment,
                          defaultEnv: event.target.value as 'staging' | 'production',
                        },
                      }
                    : prev
                )
              }
            >
              <option value="staging">staging</option>
              <option value="production">production</option>
            </select>
          </label>
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.notifications.email}
              onChange={(event) =>
                setDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          email: event.target.checked,
                        },
                      }
                    : prev
                )
              }
            />
            Email notifications
          </label>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.notifications.slack}
              onChange={(event) =>
                setDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          slack: event.target.checked,
                        },
                      }
                    : prev
                )
              }
            />
            Slack notifications
          </label>
        </section>

        <section className="rounded-xl border border-ink/10 bg-shell p-3 text-sm">
          <p>Anthropic Key: {draft.apiKeys.anthropic}</p>
          <p>Database: {draft.database.url}</p>
        </section>

        <button className="rounded-lg bg-ink px-4 py-2 text-sm text-white" type="submit">
          {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
};
