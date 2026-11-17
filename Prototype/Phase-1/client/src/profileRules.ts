/**
 * Rules for the startup profile (UC-004).
 * Same rules as server/src/utils/profileRules.ts so the page can show
 * completeness while the founder types. The server checks again on submit.
 */

export const SECTORS = ['Agritech', 'Edtech', 'E-commerce', 'Fintech', 'Healthtech', 'Logistics', 'SaaS', 'Other'];
export const STAGES = ['Idea', 'Pre-seed', 'Seed', 'Series A'];
export const CITIES = ['Islamabad', 'Karachi', 'Lahore', 'Peshawar', 'Quetta', 'Faisalabad', 'Multan', 'Other'];
export const INSTRUMENTS = ['Equity', 'SAFE', 'Convertible note', 'Grant'];

export interface TeamMember {
  name: string;
  role: string;
}

export interface Shareholder {
  holder: string;
  percentage: number | null;
}

export interface Profile {
  companyName: string;
  sector: string;
  stage: string;
  city: string;
  team: TeamMember[];
  activeCustomers: number | null;
  tractionNotes: string;
  revenuePeriod: string;
  monthlyRevenue: number | null;
  capTable: Shareholder[];
  roundAmount: number | null;
  roundInstrument: string;
  useOfFunds: string;
}

// mandatory fields from FR-001: sector, stage, team, revenue period, cap table, round details
const REQUIRED_FIELDS: { label: string; isFilled: (p: Profile) => boolean }[] = [
  { label: 'Company name', isFilled: (p) => p.companyName.trim() !== '' },
  { label: 'Sector', isFilled: (p) => p.sector !== '' },
  { label: 'Stage', isFilled: (p) => p.stage !== '' },
  { label: 'Team (at least one member with name and role)', isFilled: (p) => p.team.some((m) => m.name.trim() && m.role.trim()) },
  { label: 'Revenue period', isFilled: (p) => p.revenuePeriod !== '' },
  { label: 'Monthly revenue (PKR)', isFilled: (p) => p.monthlyRevenue !== null },
  { label: 'Cap table (at least one shareholder)', isFilled: (p) => p.capTable.some((s) => s.holder.trim() !== '') },
  { label: 'Round amount (PKR)', isFilled: (p) => p.roundAmount !== null && p.roundAmount > 0 },
  { label: 'Round instrument', isFilled: (p) => p.roundInstrument !== '' },
];

export function getMissingFields(profile: Profile): string[] {
  return REQUIRED_FIELDS.filter((field) => !field.isFilled(profile)).map((field) => field.label);
}

export function getCompleteness(profile: Profile): number {
  const filled = REQUIRED_FIELDS.length - getMissingFields(profile).length;
  return Math.round((filled / REQUIRED_FIELDS.length) * 100);
}

export function getCapTableTotal(capTable: Shareholder[]): number {
  return capTable.reduce((total, row) => total + (row.percentage || 0), 0);
}
