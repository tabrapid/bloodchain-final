import { Injectable } from '@nestjs/common';
import { SafetyLevel, InsightType } from './dto';

export { SafetyLevel, InsightType };

interface UnsafePattern {
  pattern: RegExp;
  safetyLevel: SafetyLevel;
  replacement?: string;
}

const UNSAFE_REQUEST_PATTERNS: UnsafePattern[] = [
  {
    pattern: /do i have (cancer|diabetes|anemia|hpv|hep|hepatitis| hiv|std|sti|chlamydia|syphilis|gonorrhea)/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /am i (sick|ill|diseased|healthy)/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /what disease do i have/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /diagnose me/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /should i take (medication|medicine|drugs?|pills?)/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /what (dosage|dose) should i take/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /should i stop taking (my medication|my medicine)/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /prescribe (me |me )?(medication|medicine|drugs?|treatment)/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /ignore (your|all) (safety|system|previous|original) (instructions|prompts?)/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /reveal (your |the )?(system |secret |original )?prompt/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /you are (now |just |really )?(a |an )?(doctor|physician|medic|medical professional|nurse|clinician)/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
];

const UNSAFE_OUTPUT_PATTERNS: UnsafePattern[] = [
  {
    pattern: /you (have|may have|probably have|likely have|definitely have) (cancer|diabetes|anemia|hpv|hep|hepatitis| hiv|std|sti|chlamydia|syphilis|gonorrhea)/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /i (diagnose|am diagnosing|can diagnose) you (with|as)/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /take (this |these |the following )?(medication|medicine|drugs?|pills?|prescription)/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /your dosage should be \d+/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /stop taking (your |all |any )?(medication|medicine|drugs?)/i,
    safetyLevel: SafetyLevel.OUT_OF_SCOPE,
  },
  {
    pattern: /you (definitely|certainly|absolutely|clearly) (have|are|need)/i,
    safetyLevel: SafetyLevel.NEEDS_CONTEXT,
  },
  {
    pattern: /this proves|this indicates|this means you have/i,
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
];

@Injectable()
export class AIHealthSafetyService {
  classifyRequest(input: string): SafetyLevel {
    for (const pattern of EMERGENCY_PATTERNS) {
      if (pattern.pattern.test(input)) {
        return SafetyLevel.EMERGENCY_REDIRECT;
      }
    }

    for (const pattern of UNSAFE_REQUEST_PATTERNS) {
      if (pattern.pattern.test(input)) {
        return pattern.safetyLevel;
      }
    }

    return SafetyLevel.SAFE_INFORMATIONAL;
  }

  validateOutput(output: string): { isValid: boolean; safetyLevel: SafetyLevel; reason?: string } {
    for (const pattern of EMERGENCY_PATTERNS) {
      if (pattern.pattern.test(output)) {
        return {
          isValid: false,
          safetyLevel: SafetyLevel.EMERGENCY_REDIRECT,
          reason: 'Output contains potential emergency-related content that requires immediate human assistance',
        };
      }
    }

    for (const pattern of UNSAFE_OUTPUT_PATTERNS) {
      if (pattern.pattern.test(output)) {
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
