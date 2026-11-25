// Shared types used by the pages

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: string;
}

// UC-006: readiness report
export interface Rating {
  category: string;
  rating: number | null;
  description: string;
  met: string[];
  missing: string[];
  overriddenFrom?: number | null;
  overrideReason?: string;
}

export interface Flag {
  severity: 'high' | 'medium' | 'low';
  message: string;
  source: string;
  explanation: string;
}

export interface ReadinessReport {
  id: number;
  rubricVersion: string;
  documentsChecked: boolean;
  ratings: Rating[];
  flags: Flag[];
  createdAt: string;
}
