/**
 * Builds the diligence memo (UC-016) from the shared profile, the latest financial
 * statement and the readiness flags. Every number is calculated here, in code,
 * and every claim keeps a link to where it came from.
 */
import { Profile } from './profileRules';
import { Flag } from './readinessRules';
import { MonthValue } from './extractFields';

// where a claim came from: a cell in an uploaded file, or the founder's profile
export interface Evidence {
  type: 'document' | 'profile';
  label: string;
  documentId?: number;
  cell?: string;
}

export interface Claim {
  text: string;
  evidence: Evidence[];
}

export interface Section {
  title: string;
  claims: Claim[];
  // E1: shown instead of claims when there is not enough data
  insufficient?: string;
}

export interface StatementField {
  field_name: string;
  value: number;
  source: string;
  status: string;
  series: MonthValue[] | null;
  document_id: number;
  file_name: string;
}

export interface MemoInput {
  profile: Profile;
  profileVersion: number;
  documents: { doc_type: string }[];
  statement: StatementField[];
  flags: Flag[] | null;
}

export function pkr(amount: number) {
  return `PKR ${Math.round(amount).toLocaleString('en-US')}`;
}

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function buildMemo(input: MemoInput) {
  const { profile, statement } = input;
  const fromProfile: Evidence = { type: 'profile', label: `Founder-entered profile (version ${input.profileVersion})` };

  // link to one cell of the financial statement
  function cellLink(field: StatementField, cell = field.source): Evidence {
    return { type: 'document', label: `${field.file_name}, ${cell}`, documentId: field.document_id, cell };
  }

  // E2: values marked "Verify" are left out of all calculations
  const pending = statement.filter((f) => f.status === 'verify');
  function usable(name: string) {
    return statement.find((f) => f.field_name === name && f.status !== 'verify') || null;
  }
  const revenue = usable('revenue');
  const cogs = usable('cogs');
  const costs = usable('costs');
  const burnField = usable('burn');
  const cash = usable('cash');
  const headcount = usable('headcount');

  // monthly revenue, with the latest month replaced by the confirmed value if the founder corrected it
  const months = revenue && revenue.series ? [...revenue.series] : [];
  if (revenue && months.length > 0) {
    months[months.length - 1] = { ...months[months.length - 1], value: revenue.value };
  }

  // ---- calculations ----

  let growth: number | null = null;
  if (months.length >= 2 && months[months.length - 2].value > 0) {
    const last = months[months.length - 1].value;
    const previous = months[months.length - 2].value;
    growth = ((last - previous) / previous) * 100;
  }

  let totalGrowth: number | null = null;
  if (months.length >= 3 && months[0].value > 0) {
    totalGrowth = ((months[months.length - 1].value - months[0].value) / months[0].value) * 100;
  }

  let grossMargin: number | null = null;
  if (revenue && cogs && revenue.value > 0) {
    grossMargin = ((revenue.value - cogs.value) / revenue.value) * 100;
  }

  // burn from the statement, or worked out as all costs minus revenue
  let burn: number | null = null;
  let burnEvidence: Evidence[] = [];
  let burnText = '';
  if (burnField) {
    burn = burnField.value;
    burnEvidence = [cellLink(burnField)];
    burnText = `Monthly burn is ${pkr(burn)}.`;
  } else if (revenue && costs) {
    burn = costs.value + (cogs ? cogs.value : 0) - revenue.value;
    burnEvidence = [cellLink(costs), cellLink(revenue)].concat(cogs ? [cellLink(cogs)] : []);
    burnText =
      burn > 0
        ? `Monthly burn is ${pkr(burn)} (costs minus revenue).`
        : `The startup is profitable: revenue is ${pkr(-burn)} more than costs this month.`;
  }

  let runway: number | null = null;
  if (cash && burn !== null && burn > 0) {
    runway = cash.value / burn;
  }

  // ---- sections ----

  const members = profile.team.filter((m) => m.name.trim() !== '');
  const teamNames = members.map((m) => m.name.trim().toLowerCase());
  const teamShare = profile.capTable
    .filter((s) => teamNames.includes(s.holder.trim().toLowerCase()))
    .reduce((total, s) => total + (s.percentage || 0), 0);

  const team: Section = { title: 'Team', claims: [] };
  if (members.length > 0) {
    team.claims.push({
      text: `Team of ${members.length}: ${members.map((m) => `${m.name} (${m.role || 'role not given'})`).join(', ')}.`,
      evidence: [fromProfile],
    });
    if (teamShare > 0) {
      team.claims.push({ text: `Team members own ${percent(teamShare)} of the company.`, evidence: [fromProfile] });
    }
  }
  if (headcount) {
    team.claims.push({ text: `Headcount in the financial statement is ${headcount.value}.`, evidence: [cellLink(headcount)] });
  }
  if (team.claims.length === 0) {
    team.insufficient = 'Insufficient data. The team section of the startup profile is empty.';
  }

  const market: Section = { title: 'Market position', claims: [] };
  if (profile.sector || profile.stage) {
    const words = [profile.stage, profile.sector, 'startup'].filter((w) => w).join(' ');
    const place = profile.city ? ` based in ${profile.city}` : '';
    market.claims.push({ text: `${words}${place}.`, evidence: [fromProfile] });
  }
  if (profile.roundAmount) {
    const instrument = profile.roundInstrument ? ` through ${profile.roundInstrument}` : '';
    market.claims.push({ text: `Raising ${pkr(profile.roundAmount)}${instrument}.`, evidence: [fromProfile] });
  }
  if (profile.useOfFunds.trim()) {
    market.claims.push({ text: `Use of funds: ${profile.useOfFunds.trim()}`, evidence: [fromProfile] });
  }
  if (market.claims.length === 0) {
    market.insufficient = 'Insufficient data. Sector, stage and round details are missing from the profile.';
  }

  const traction: Section = { title: 'Traction', claims: [] };
  if (profile.activeCustomers !== null) {
    traction.claims.push({ text: `${profile.activeCustomers.toLocaleString('en-US')} active customers.`, evidence: [fromProfile] });
  }
  if (growth !== null) {
    const last = months[months.length - 1];
    const previous = months[months.length - 2];
    traction.claims.push({
      text: `Revenue ${growth >= 0 ? 'grew' : 'fell'} ${percent(Math.abs(growth))} in the latest month (${pkr(previous.value)} to ${pkr(last.value)}).`,
      evidence: [cellLink(revenue!, previous.cell), cellLink(revenue!, last.cell)],
    });
  }
  if (totalGrowth !== null) {
    traction.claims.push({
      text: `Over ${months.length} months revenue changed by ${percent(totalGrowth)}.`,
      evidence: [cellLink(revenue!, months[0].cell), cellLink(revenue!, months[months.length - 1].cell)],
    });
  }
  if (revenue && profile.activeCustomers) {
    traction.claims.push({
      text: `Revenue per customer is ${pkr(revenue.value / profile.activeCustomers)} per month.`,
      evidence: [cellLink(revenue), fromProfile],
    });
  }
  if (traction.claims.length === 0) {
    traction.insufficient = 'Insufficient data. Needs active customers in the profile and a financial statement (XLSX) with monthly revenue.';
  }

  const financials: Section = { title: 'Financials', claims: [] };
  if (revenue) {
    financials.claims.push({ text: `Latest monthly revenue is ${pkr(revenue.value)}.`, evidence: [cellLink(revenue)] });
  }
  if (grossMargin !== null) {
    financials.claims.push({
      text: `Gross margin is ${percent(grossMargin)}.`,
      evidence: [cellLink(revenue!), cellLink(cogs!)],
    });
  }
  if (burn !== null) {
    financials.claims.push({ text: burnText, evidence: burnEvidence });
  }
  if (cash) {
    financials.claims.push({ text: `Cash in bank is ${pkr(cash.value)}.`, evidence: [cellLink(cash)] });
  }
  if (runway !== null) {
    financials.claims.push({
      text: `Runway is about ${runway.toFixed(1)} months (cash divided by burn).`,
      evidence: [cellLink(cash!), ...burnEvidence],
    });
  }
  if (financials.claims.length === 0) {
    financials.insufficient = 'Insufficient data. Upload a financial statement (XLSX) with revenue, costs and cash.';
  }

  // ---- risks and red flags (rules) ----

  const risks: Section = { title: 'Risks', claims: [] };
  const redFlags: Section = { title: 'Red flags', claims: [] };

  if (runway !== null && runway < 6) {
    redFlags.claims.push({ text: `Runway is under 6 months (${runway.toFixed(1)} months).`, evidence: [cellLink(cash!), ...burnEvidence] });
  } else if (runway !== null && runway < 12) {
    risks.claims.push({ text: `Runway is under 12 months (${runway.toFixed(1)} months).`, evidence: [cellLink(cash!), ...burnEvidence] });
  }

  if (months.length >= 3) {
    const [a, b, c] = months.slice(-3);
    if (b.value < a.value && c.value < b.value) {
      redFlags.claims.push({
        text: 'Revenue fell in each of the last two months.',
        evidence: [cellLink(revenue!, a.cell), cellLink(revenue!, b.cell), cellLink(revenue!, c.cell)],
      });
    }
  }

  if (revenue && profile.monthlyRevenue !== null && Math.abs(profile.monthlyRevenue - revenue.value) > revenue.value * 0.1) {
    redFlags.claims.push({
      text: `Profile revenue (${pkr(profile.monthlyRevenue)}) does not match the financial statement (${pkr(revenue.value)}).`,
      evidence: [fromProfile, cellLink(revenue)],
    });
  }

  if (grossMargin !== null && grossMargin < 20) {
    risks.claims.push({ text: `Low gross margin (${percent(grossMargin)}).`, evidence: [cellLink(revenue!), cellLink(cogs!)] });
  }
  if (members.length === 1) {
    risks.claims.push({ text: 'Only one team member is listed.', evidence: [fromProfile] });
  }
  if (members.length > 0 && profile.capTable.length > 0 && teamShare <= 50) {
    risks.claims.push({ text: `Team members own only ${percent(teamShare)} of the company.`, evidence: [fromProfile] });
  }
  for (const type of ['Incorporation document', 'Cap table']) {
    if (!input.documents.some((d) => d.doc_type === type)) {
      risks.claims.push({ text: `${type} has not been uploaded to the data room.`, evidence: [fromProfile] });
    }
  }

  // flags from the founder's latest readiness report (UC-006)
  for (const flag of input.flags || []) {
    const explanation = flag.explanation ? ` Founder's explanation: "${flag.explanation}"` : ' Not explained by the founder.';
    // the same problem may already be found above, then only the explanation is added
    const same = [...redFlags.claims, ...risks.claims].find((c) => c.text.startsWith(flag.message));
    if (same) {
      same.text += explanation;
      continue;
    }
    const claim = { text: `${flag.message}.${explanation}`, evidence: [{ type: 'profile' as const, label: `Readiness report: ${flag.source}` }] };
    if (flag.severity === 'high') {
      redFlags.claims.push(claim);
    } else {
      risks.claims.push(claim);
    }
  }
  if (redFlags.claims.length === 0) {
    redFlags.claims.push({ text: 'No red flags found in the available data.', evidence: [fromProfile] });
  }

  return {
    sections: [team, market, traction, financials, risks, redFlags],
    // E2: shown separately so the analyst knows what was left out
    pending: pending.map((f) => ({ field: f.field_name, value: f.value, label: `${f.file_name}, ${f.source}` })),
    numbers: { revenue: revenue ? revenue.value : null, growth, totalGrowth, grossMargin, burn, cash: cash ? cash.value : null, runway },
  };
}

export type Memo = ReturnType<typeof buildMemo>;
