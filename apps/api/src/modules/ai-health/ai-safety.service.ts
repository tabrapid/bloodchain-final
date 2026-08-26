import { Injectable } from '@nestjs/common';
import { SafetyLevel, InsightType } from './dto';

export { SafetyLevel, InsightType };

interface UnsafePattern {
  pattern: RegExp;
  safetyLevel: SafetyLevel;
  replacement?: string;
}

// Matches a diagnosis-shaped noun phrase without depending on an enumerated
// disease list, which by construction can never be complete (the previous
// version only recognized 9 specific conditions -- "do I have lupus?" or
// "you likely have COPD" sailed straight through). Combines a short list of
// conditions common enough to name explicitly with two structural catches:
// common medical-term suffixes (anemia, hepatitis, thrombosis, carcinoma,
// neuropathy, neuralgia, ...) and generic diagnosis nouns (disease,
// disorder, deficiency, infection, syndrome), which together cover the vast
// majority of real condition names without needing to list them individually.
const DIAGNOSIS_TERM =
  '(?:cancer|diabetes|hiv|aids|std|sti|hpv|hepatitis|hep|chlamydia|syphilis|gonorrhea|' +
  'lupus|leukemia|lymphoma|tuberculosis|copd|[a-z]+(?:emia|itis|osis|oma|pathy|algia)|' +
  '[a-z ]{0,20}(?:disease|disorder|deficiency|infection|syndrome))';

const UNSAFE_REQUEST_PATTERNS: UnsafePattern[] = [
  {
    pattern: new RegExp(`\\bdo i have\\b.{0,40}?\\b${DIAGNOSIS_TERM}`, 'i'),
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: new RegExp(`\\b(could|might|do you think) i have\\b.{0,40}?\\b${DIAGNOSIS_TERM}`, 'i'),
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\bam i (sick|ill|diseased|healthy)\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\bwhat('s| is) wrong with me\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\bwhat (disease|condition|illness) do i have\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\bdiagnose me\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\b(am i|do i) (test|tested)?\s*(positive|negative) for\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\bshould i take (medication|medicine|drugs?|pills?|supplements?)\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\bwhat (dosage|dose) should i take\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\bshould i stop taking (my medication|my medicine)\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\bprescribe (me )?(medication|medicine|drugs?|treatment)\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\bignore (your|all) (safety|system|previous|original) (instructions|prompts?)\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\breveal (your |the )?(system |secret |original )?prompt\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\byou are (now |just |really )?(a |an )?(doctor|physician|medic|medical professional|nurse|clinician)\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\bcan i donate blood (if|when|while) (i('m| am) (sick|ill|fever|unwell|nauseous|dizzy|tired|exhausted))\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\bshould i donate blood (if|when|while) (i('m| am) (sick|ill|fever|unwell|nauseous|dizzy|tired|exhausted))\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\bcan i ignore (this |my )?(result|symptom|test|doctor)\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\bwhat (pill|drug|medicine|medication|treatment) should i (take|use)\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\bis this (dangerous|serious|fatal|deadly|critical|life.?threatening)\b/i,
    safetyLevel: SafetyLevel.PROFESSIONAL_REVIEW_SUGGESTED,
  },
  {
    pattern: /\bam i (going to|gonna) (die|be okay|be fine)\b/i,
    safetyLevel: SafetyLevel.PROFESSIONAL_REVIEW_SUGGESTED,
  },
];

const UNSAFE_OUTPUT_PATTERNS: UnsafePattern[] = [
  {
    pattern: new RegExp(
      `\\byou (have|may have|probably have|likely have|definitely have|are diagnosed with|suffer from|test(?:ed)? positive for)\\b.{0,40}?\\b${DIAGNOSIS_TERM}`,
      'i',
    ),
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    // "is/are/appears consistent with|indicative of|suggestive of a diagnosis
    // of X" is textbook clinical diagnostic phrasing regardless of what X is
    // -- an informational insight has no business ever phrasing anything
    // this way, so this stays broad rather than requiring a DIAGNOSIS_TERM.
    pattern: /\b(is|are|appears?|seems?|looks?) (consistent with|indicative of|suggestive of|characteristic of|typical of)\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\bi (diagnose|am diagnosing|can diagnose) you (with|as)\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\btake (this |these |the following )?(medication|medicine|drugs?|pills?|prescription|supplement)\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\byour dosage should be \d+\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\bstop taking (your |all |any )?(medication|medicine|drugs?)\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\byou (definitely|certainly|absolutely|clearly) (have|are|need)\b/i,
    safetyLevel: SafetyLevel.NEEDS_CONTEXT,
  },
  {
    pattern: /\b(this proves|this indicates|this means you have)\b/i,
    safetyLevel: SafetyLevel.NEEDS_CONTEXT,
  },
  {
    pattern: /\byou should (donate|not donate) blood\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\bignore (this|your) (doctor|physician|healthcare professional|medical)\b/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /\b\d+%?\s*confiden/i,
    safetyLevel: SafetyLevel.NEEDS_CONTEXT,
  },
];

const EMERGENCY_PATTERNS: UnsafePattern[] = [
  {
    pattern: /i'm (suicidal|going to kill|going to die|harm myself)/i,
    safetyLevel: SafetyLevel.EMERGENCY_REDIRECT,
  },
  {
    pattern: /i want to (kill|hurt|murder) (myself|someone)/i,
    safetyLevel: SafetyLevel.EMERGENCY_REDIRECT,
  },
  {
    pattern: /i'm bleeding (badly|severely|a lot)|severe bleeding/i,
    safetyLevel: SafetyLevel.EMERGENCY_REDIRECT,
  },
  {
    pattern: /i can't breathe|chest pain (so |very )?(severe|bad|intense)/i,
    safetyLevel: SafetyLevel.EMERGENCY_REDIRECT,
  },
  {
    pattern: /stroke|heart attack|losing consciousness|seizure/i,
    safetyLevel: SafetyLevel.EMERGENCY_REDIRECT,
  },
];

@Injectable()
export class AIHealthSafetyService {
  classifyRequest(input: string): SafetyLevel {
    const normalized = this.normalizeForMatching(input);

    for (const pattern of EMERGENCY_PATTERNS) {
      if (pattern.pattern.test(normalized)) {
        return SafetyLevel.EMERGENCY_REDIRECT;
      }
    }

    for (const pattern of UNSAFE_REQUEST_PATTERNS) {
      if (pattern.pattern.test(normalized)) {
        return pattern.safetyLevel;
      }
    }

    return SafetyLevel.SAFE_INFORMATIONAL;
  }

  validateOutput(output: string): { isValid: boolean; safetyLevel: SafetyLevel; reason?: string } {
    const normalized = this.normalizeForMatching(output);

    for (const pattern of EMERGENCY_PATTERNS) {
      if (pattern.pattern.test(normalized)) {
        return {
          isValid: false,
          safetyLevel: SafetyLevel.EMERGENCY_REDIRECT,
          reason: 'Output contains potential emergency-related content that requires immediate human assistance',
        };
      }
    }

    for (const pattern of UNSAFE_OUTPUT_PATTERNS) {
      if (pattern.pattern.test(normalized)) {
        return {
          isValid: false,
          safetyLevel: pattern.safetyLevel,
          reason: 'Output contains potentially unsafe medical content',
        };
      }
    }

    return {
      isValid: true,
      safetyLevel: SafetyLevel.SAFE_INFORMATIONAL,
    };
  }

  // Every pattern above is written with literal single spaces between
  // words, e.g. /do i have/. A regex space only ever matches exactly one
  // space character, so inserting an extra space, tab, or newline between
  // any two words -- "do  i  have cancer" -- silently defeated every
  // pattern in this file. Collapsing whitespace runs to a single space
  // before matching closes that off without having to rewrite every
  // pattern to use \s+.
  private normalizeForMatching(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  sanitizeInput(input: string): string {
    return input
      .split('')
      .filter((char) => {
        const code = char.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      .join('')
      .trim()
      .slice(0, 2000);
  }

  getSafeFallback(safetyLevel: SafetyLevel, context?: string): Record<string, unknown> {
    if (safetyLevel === SafetyLevel.EMERGENCY_REDIRECT) {
      return {
        title: 'Please seek immediate help',
        summary: 'If you are experiencing a medical emergency, please contact emergency services or go to your nearest emergency room.',
        observations: [],
        caveats: [
          'This assistant is not a substitute for professional medical care.',
          'If you are in crisis, please reach out to emergency services.',
        ],
        questionsForProfessional: [],
        safetyLevel: SafetyLevel.EMERGENCY_REDIRECT,
        type: InsightType.GENERAL_HEALTH_INFORMATION,
      };
    }

    return {
      title: 'Outside my scope',
      summary: "I can't help with that request. This assistant provides informational insights based on your recorded laboratory data only.",
      observations: [],
      caveats: [
        'This assistant cannot diagnose conditions, prescribe treatments, or provide medical advice.',
        'Please consult a qualified healthcare provider for medical concerns.',
      ],
      questionsForProfessional: ['What should I discuss with my healthcare provider about this concern?'],
      safetyLevel: SafetyLevel.OUT_OF_SCOPE,
      type: InsightType.GENERAL_HEALTH_INFORMATION,
    };
  }

  shouldRetryWithConstraints(safetyLevel: SafetyLevel): boolean {
    return safetyLevel === SafetyLevel.NEEDS_CONTEXT || safetyLevel === SafetyLevel.PROFESSIONAL_REVIEW_SUGGESTED;
  }
}
