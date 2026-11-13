import { assertPolicy } from './policy.js';
import type { DatasetPolicy } from './types.js';
import { isText } from './values.js';

function validKeywords(keywords: unknown): keywords is string[] {
  return Array.isArray(keywords) && keywords.every(isText);
}

function stageValue(keywords: readonly string[], policy: DatasetPolicy): string | undefined {
  const declared = keywords.filter((keyword) => keyword.startsWith('stage:'));

  if (
    declared.length > 1 ||
    (declared.length === 1 && !Object.hasOwn(policy.stages, declared[0].slice(6)))
  ) {
    throw new Error('keywords must contain at most one known stage: keyword');
  }

  return declared[0]?.slice(6);
}

export function getStage(keywords: unknown, policy: unknown): string | undefined {
  assertPolicy(policy);
  if (keywords === undefined) return undefined;

  if (!validKeywords(keywords)) {
    throw new Error('keywords must be an array of nonblank strings');
  }

  return stageValue(keywords, policy);
}

export function stageLabel(keywords: unknown, policy: unknown): string | undefined {
  assertPolicy(policy);
  const stage = getStage(keywords, policy);

  return stage === undefined ? undefined : policy.stages[stage];
}

export function validateKeywords(keywords: unknown, policy: DatasetPolicy): string[] {
  if (keywords === undefined) keywords = [];

  if (!validKeywords(keywords)) {
    return ['keywords must be an array of nonblank strings'];
  }

  const errors: string[] = [];

  try {
    stageValue(keywords, policy);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    errors.push(error.message);
  }

  for (const prefix of policy.keywords.requiredPrefixes) {
    const found = keywords.filter((keyword) => keyword.startsWith(`${prefix}:`));

    if (prefix === 'stage' && found.length > 0) continue;

    if (found.length !== 1 || !isText(found[0].slice(prefix.length + 1))) {
      errors.push(`keywords must contain exactly one nonempty ${prefix}: keyword`);
    }
  }

  if (!policy.keywords.allowOtherKeywords) {
    const allowed = [...policy.keywords.requiredPrefixes, 'stage'];

    if (keywords.some((keyword) => !allowed.some((prefix) => keyword.startsWith(`${prefix}:`)))) {
      errors.push('other keywords are not allowed by the policy');
    }
  }

  return errors;
}
