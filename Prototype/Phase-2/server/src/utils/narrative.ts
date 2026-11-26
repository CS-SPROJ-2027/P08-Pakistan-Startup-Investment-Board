/**
 * Writes the short summary paragraph of the diligence memo (UC-016).
 * First it asks a local AI model (Ollama). If Ollama is not running, is too slow,
 * or its answer has a number that is not in our facts, the rule-based writer is used.
 * Either way, only facts that were calculated or extracted in code are used.
 */
import logger from '../config/logger';
import { Memo, pkr } from './memoRules';
import { Profile } from './profileRules';

// can be changed in .env, these are the defaults
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';

export interface Narrative {
  text: string;
  method: 'ai' | 'rules';
  model: string | null;
}

// All claims of the memo as a plain list, this is the only thing the AI sees
function getFacts(companyName: string, memo: Memo) {
  const facts = [`Company name: ${companyName}.`];
  for (const section of memo.sections) {
    for (const claim of section.claims) {
      facts.push(`${section.title}: ${claim.text}`);
    }
  }
  return facts;
}

// Numbers in a text, e.g. "PKR 1,200,000 and 18.5%" -> ["1200000", "18.5"]
function numbersIn(text: string) {
  return (text.match(/\d[\d,]*(\.\d+)?/g) || []).map((n) => n.replace(/,/g, ''));
}

async function writeWithOllama(facts: string[]) {
  const prompt =
    'You are writing the summary of an investor diligence memo. ' +
    'Write one neutral paragraph of at most 120 words using ONLY the facts below. ' +
    'Do not add any number, name or claim that is not in the facts. Do not give advice.\n\n' +
    facts.join('\n');

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, options: { temperature: 0.2 } }),
    // the memo must be shown within 90 seconds, so stop waiting after 60
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}`);
  }

  const data = await response.json();
  const text = String(data.response || '').trim();
  if (text.length < 20) {
    throw new Error('Ollama returned an empty answer');
  }

  // no value is invented: every number in the answer must be in the facts
  const allowed = numbersIn(facts.join(' '));
  const invented = numbersIn(text).filter((n) => !allowed.includes(n));
  if (invented.length > 0) {
    throw new Error(`Ollama used numbers that are not in the facts: ${invented.join(', ')}`);
  }
  return text;
}

// Rule-based summary: each sentence is only added when its data exists
function writeWithRules(profile: Profile, memo: Memo) {
  const n = memo.numbers;
  const sentences: string[] = [];
  const members = profile.team.filter((m) => m.name.trim() !== '').length;

  const words = [profile.stage, profile.sector, 'startup'].filter((w) => w).join(' ');
  let intro = `${profile.companyName} is a ${words}`;
  if (profile.city) intro += ` based in ${profile.city}`;
  if (members > 0) intro += ` with a team of ${members}`;
  sentences.push(`${intro}.`);

  if (n.growth !== null && n.revenue !== null) {
    sentences.push(
      `Revenue ${n.growth >= 0 ? 'grew' : 'fell'} ${Math.abs(n.growth).toFixed(1)}% in the latest month to ${pkr(n.revenue)}` +
        (profile.activeCustomers ? ` from ${profile.activeCustomers.toLocaleString('en-US')} active customers.` : '.')
    );
  } else if (n.revenue !== null) {
    sentences.push(`Latest monthly revenue is ${pkr(n.revenue)}.`);
  } else {
    sentences.push('Financial analysis is limited because no financial statement values could be used.');
  }

  if (n.grossMargin !== null) {
    sentences.push(`Gross margin is ${n.grossMargin.toFixed(1)}%.`);
  }
  if (n.runway !== null && n.burn !== null) {
    sentences.push(`At the current burn of ${pkr(n.burn)} a month, cash covers about ${n.runway.toFixed(1)} months.`);
  } else if (n.burn !== null && n.burn <= 0) {
    sentences.push('The startup is currently profitable.');
  }

  const redFlags = memo.sections.find((s) => s.title === 'Red flags')!.claims;
  const risks = memo.sections.find((s) => s.title === 'Risks')!.claims;
  const realFlags = redFlags.filter((c) => !c.text.startsWith('No red flags'));
  if (realFlags.length > 0) {
    // only the problem itself, without the founder's explanation
    const problems = realFlags.map((c) => c.text.split(' Founder')[0].split(' Not explained')[0].replace(/\.$/, ''));
    sentences.push(`Main concerns: ${problems.join('; ')}.`);
  } else if (risks.length > 0) {
    sentences.push(`No red flags were found, but ${risks.length} point(s) should be checked.`);
  } else {
    sentences.push('No red flags or risks were found in the available data.');
  }
  return sentences.join(' ');
}

export async function writeNarrative(profile: Profile, memo: Memo): Promise<Narrative> {
  try {
    const text = await writeWithOllama(getFacts(profile.companyName, memo));
    return { text, method: 'ai', model: OLLAMA_MODEL };
  } catch (err) {
    // E3: the AI is not available, so the summary is written by rules instead
    logger.info(`Using rule-based summary: ${(err as Error).message}`);
    return { text: writeWithRules(profile, memo), method: 'rules', model: null };
  }
}
