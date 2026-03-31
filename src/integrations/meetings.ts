import { createLogger, format, transports } from 'winston';
import { SalesLead, SalesQualificationResult } from '../types';

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

export interface MeetingResponse {
  meetingId: string;
  status: 'scheduled' | 'pending';
  scheduledAt: string;
  meetingUrl: string;
}

const generateMeetingId = (): string => `mtg_${Math.random().toString(36).slice(2, 12)}`;

const nextBusinessMorningUtc = (): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  date.setUTCHours(15, 0, 0, 0);
  return date.toISOString();
};

export class MeetingsAdapter {
  private readonly isMockMode: boolean;
  private readonly baseUrl: string;

  constructor() {
    this.isMockMode = process.env.USE_MOCK_INTEGRATIONS === 'true';
    this.baseUrl = process.env.MEETING_BASE_URL || 'https://mock-meetings.example.com';

    logger.info('[Meetings] initialized', {
      mode: this.isMockMode ? 'mock' : 'live',
      baseUrl: this.baseUrl,
    });
  }

  scheduleMeeting = async (
    lead: SalesLead,
    qualification: SalesQualificationResult
  ): Promise<MeetingResponse> => {
    if (this.isMockMode) {
      const meetingId = generateMeetingId();
      const scheduledAt = nextBusinessMorningUtc();

      logger.info('[Meetings MOCK] schedule_meeting', {
        meetingId,
        company: lead.company,
        tier: qualification.tier,
      });

      return {
        meetingId,
        status: 'scheduled',
        scheduledAt,
        meetingUrl: `${this.baseUrl}/meeting/${meetingId}`,
      };
    }

    throw new Error('Live meeting integration not implemented. Set USE_MOCK_INTEGRATIONS=true');
  };
}

export const meetingsAdapter = new MeetingsAdapter();
