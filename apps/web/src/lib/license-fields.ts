import { validateMetadata } from '@penjaga/validator';
import policy from '@penjaga/validator/policy' with { type: 'json' };

export const LICENSE_PRESETS = [
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'LGPL-3.0-only',
  'MPL-2.0',
  'CC0-1.0',
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
  'ODbL-1.0',
  'PDDL-1.0',
  'Unlicense',
] as const;

export type LicenseModel = { names: string[]; required: boolean; message: string };
const MAX_LICENSES = 200;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function licenseFormModel(text: string): LicenseModel {
  const model: LicenseModel = {
    names: [],
    required: policy.package.requiredFields.includes('licenses'),
    message: '',
  };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (cause) {
    if (!(cause instanceof SyntaxError)) throw cause;
    return { ...model, message: 'Licenses cannot be loaded from invalid JSON.' };
  }

  if (!object(data) || data.licenses === undefined) return model;
  if (!Array.isArray(data.licenses)) {
    return { ...model, message: 'Licenses must be an array; see the raw descriptor.' };
  }
  if (data.licenses.length > MAX_LICENSES) {
    return { ...model, message: 'License form limit: 200 names. See the raw descriptor.' };
  }

  for (const license of data.licenses) {
    if (object(license) && typeof license.name === 'string') {
      model.names.push(license.name);
    } else {
      model.message = 'Some supplied license entries are unsupported by the name-only form; see the raw descriptor. Nothing is saved.';
    }
  }
  return model;
}

const packageIssues = new Set(validateMetadata({}, policy));

export function licenseDraftIssues(
  names: string[],
  required = policy.package.requiredFields.includes('licenses'),
): string[] {
  if (names.length === 0 && !required) return [];
  const licenses = names.map((name) => ({ name }));
  return validateMetadata({ licenses }, policy).filter((issue) => !packageIssues.has(issue));
}
