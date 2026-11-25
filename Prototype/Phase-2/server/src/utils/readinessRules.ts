/**
 * Rubric and consistency checks for the readiness report (UC-006).
 * All ratings and flags are decided by the rules below, not by AI.
 * Each category has 5 criteria, so the rating is the number of criteria met (0 to 5).
 * A category with no supporting evidence is "Not assessed" and gets no number.
 */
import { Profile, getCapTableTotal } from './profileRules';

export const RUBRIC_VERSION = 'v1';

// the documents every startup is expected to upload
const REQUIRED_DOCUMENTS = ['Financial statement', 'Incorporation document', 'Cap table'];

export interface DocumentInfo {
  doc_type: string;
  file_name: string;
  extraction_status: string;
}

// a value read from the latest financial statement (UC-005)
export interface StatementValue {
  value: number;
  source: string;
  status: string;
}

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

// Short text shown next to each rating
export function describeRating(rating: number | null) {
  if (rating === null) return 'Not assessed';
  if (rating === 5) return 'Investor ready';
  if (rating === 4) return 'Strong';
  if (rating >= 2) return 'Developing';
  return 'Weak';
}

// Builds one category: hasEvidence decides "Not assessed", each criterion is [text, passed]
function rateCategory(category: string, hasEvidence: boolean, criteria: [string, boolean][]): Rating {
  const met = criteria.filter((c) => c[1]).map((c) => c[0]);
  const missing = criteria.filter((c) => !c[1]).map((c) => c[0]);
  const rating = hasEvidence ? met.length : null;
  return { category, rating, description: describeRating(rating), met, missing };
}

// True if the two amounts are within 10% of each other
function closeEnough(a: number, b: number) {
  return Math.abs(a - b) <= Math.abs(b) * 0.1;
}

export function buildReport(
  profile: Profile,
  status: string,
  documents: DocumentInfo[],
  statement: Record<string, StatementValue>
) {
  const flags: Flag[] = [];
  const hasDoc = (type: string) => documents.some((d) => d.doc_type === type);

  // E2: documents are only checked if at least one file was extracted
  const documentsChecked = documents.some((d) => d.extraction_status === 'extracted');

  // values from the statement are used only if they are accepted or confirmed by the founder
  const usable = (field: string) =>
    statement[field] && statement[field].status !== 'verify' ? statement[field] : null;
  const revenue = usable('revenue');
  const burn = usable('burn');
  const cash = usable('cash');
  const headcount = usable('headcount');

  // ---- consistency checks ----

  // rounded so that e.g. 33.3 + 33.3 + 33.4 counts as 100
  const capTotal = Math.round(getCapTableTotal(profile.capTable) * 100) / 100;
  const hasCapTable = profile.capTable.some((s) => s.holder.trim() !== '');
  if (hasCapTable && capTotal !== 100) {
    flags.push({
      severity: 'high',
      message: `Cap table adds up to ${capTotal}%, not 100%`,
      source: 'Profile: cap table',
      explanation: '',
    });
  }

  if (documentsChecked && revenue && profile.monthlyRevenue !== null && !closeEnough(profile.monthlyRevenue, revenue.value)) {
    flags.push({
      severity: 'high',
      message: `Profile revenue (PKR ${profile.monthlyRevenue.toLocaleString()}) does not match the financial statement (PKR ${revenue.value.toLocaleString()})`,
      source: revenue.source,
      explanation: '',
    });
  }

  if (statement.revenue && statement.revenue.status === 'verify') {
    flags.push({
      severity: 'low',
      message: 'Revenue in the financial statement is marked "Verify" and was not used',
      source: statement.revenue.source,
      explanation: '',
    });
  }

  if (profile.monthlyRevenue && profile.monthlyRevenue > 0 && !profile.activeCustomers) {
    flags.push({
      severity: 'medium',
      message: 'Revenue is entered but active customers is 0 or empty',
      source: 'Profile: traction',
      explanation: '',
    });
  }

  for (const type of REQUIRED_DOCUMENTS) {
    if (!hasDoc(type)) {
      flags.push({ severity: 'medium', message: `${type} has not been uploaded`, source: 'Data room', explanation: '' });
    }
  }

  // ---- rubric categories ----

  const members = profile.team.filter((m) => m.name.trim() !== '');
  const team = rateCategory('Team', members.length > 0, [
    ['At least one team member added', members.length >= 1],
    ['At least two team members', members.length >= 2],
    ['Every member has a name and role', members.length > 0 && profile.team.every((m) => m.name.trim() && m.role.trim())],
    ['A founder or CEO is listed', members.some((m) => /founder|ceo/i.test(m.role))],
    ['Headcount shown in a financial statement', headcount !== null],
  ]);

  const customers = profile.activeCustomers || 0;
  const traction = rateCategory('Traction', profile.activeCustomers !== null || profile.tractionNotes.trim() !== '', [
    ['Has active customers', customers > 0],
    ['At least 100 active customers', customers >= 100],
    ['At least 1,000 active customers', customers >= 1000],
    ['Traction notes written (50+ characters)', profile.tractionNotes.trim().length >= 50],
    ['Earning revenue', (profile.monthlyRevenue || 0) > 0],
  ]);

  const revenueMatches =
    documentsChecked && revenue !== null && profile.monthlyRevenue !== null && closeEnough(profile.monthlyRevenue, revenue.value);
  const runway = cash && burn && burn.value > 0 ? cash.value / burn.value : 0;
  const financials = rateCategory('Financials', profile.monthlyRevenue !== null || hasDoc('Financial statement'), [
    ['Monthly revenue and period entered', profile.monthlyRevenue !== null && profile.revenuePeriod !== ''],
    ['Financial statement uploaded', hasDoc('Financial statement')],
    ['Profile revenue matches the financial statement', revenueMatches],
    ['Monthly burn known from the statement', burn !== null],
    ['Runway of at least 12 months (cash / burn)', runway >= 12],
  ]);

  // ownership held by people who are also in the team list
  const teamNames = members.map((m) => m.name.trim().toLowerCase());
  const founderShare = profile.capTable
    .filter((s) => teamNames.includes(s.holder.trim().toLowerCase()))
    .reduce((total, s) => total + (s.percentage || 0), 0);
  const capTable = rateCategory('Cap table', hasCapTable, [
    ['At least one shareholder listed', hasCapTable],
    ['Total is exactly 100%', capTotal === 100],
    ['Every shareholder has a name and percentage', hasCapTable && profile.capTable.every((s) => s.holder.trim() && s.percentage !== null)],
    ['Team members own more than 50%', founderShare > 50],
    ['Cap table document uploaded', hasDoc('Cap table')],
  ]);

  const fundraising = rateCategory('Fundraising', profile.roundAmount !== null && profile.roundAmount > 0, [
    ['Round amount entered', profile.roundAmount !== null && profile.roundAmount > 0],
    ['Instrument chosen', profile.roundInstrument !== ''],
    ['Use of funds explained (50+ characters)', profile.useOfFunds.trim().length >= 50],
    ['Incorporation document uploaded', hasDoc('Incorporation document')],
    ['Profile submitted (Ready for review)', status === 'ready_for_review'],
  ]);

  return {
    documentsChecked,
    ratings: [team, traction, financials, capTable, fundraising],
    flags,
  };
}
