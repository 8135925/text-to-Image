// buildPrompt：按模式分发组装（spec 2.2 v4）
export {
  validateInput,
  ERROR_MESSAGES,
  MODE_LABELS,
  MODE_HINTS,
  TEXT_MAX_LEN,
} from './types';
export type {
  Mode,
  GenerateInput,
  GenerateResponse,
  GenerateSuccess,
  GenerateFailure,
} from './types';

export {
  STYLE_DNA,
  XIAOHEI_IP,
  XIAOHEI_STRUCTURES,
  STYLE_DNA_B,
  REFERENCE_MATCH_CLAUSE,
  BODY_ROLE_LOCK,
  HANDDRAWN_ARCHETYPES,
  deriveTitle,
  buildXiaoheiPrompt,
  buildHanddrawnPrompt,
} from './constants';

import type { GenerateInput } from './types';
import { buildXiaoheiPrompt, buildHanddrawnPrompt } from './constants';

/** 按所选模式把语料常量与用户文本拼装为完整提示词 */
export function buildPrompt(input: GenerateInput): string {
  return input.mode === 'xiaohei'
    ? buildXiaoheiPrompt(input.text)
    : buildHanddrawnPrompt(input.text);
}
