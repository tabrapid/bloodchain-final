import { Injectable } from '@nestjs/common';
import {
  SYSTEM_PROMPT,
  TREND_SUMMARY_PROMPT,
  RESULT_EXPLANATION_PROMPT,
  DATA_CHANGE_PROMPT,
  GENERAL_INFO_PROMPT,
  QUESTION_SUGGESTION_PROMPT,
  CHAT_PROMPT,
} from './system';
import { InsightType } from '../dto';
import { AI_PROMPT_VERSIONS, PromptVersionKey, PromptVersion } from './prompt-versions';

export interface TrendContext {
  parameterCode: string;
  parameterName: string;
  unit?: string;
  latestValue: number;
  latestDate: string;
  previousValue?: number;
  previousDate?: string;
  absoluteChange?: number;
  percentageChange?: number;
  trend: 'INCREASING' | 'DECREASING' | 'STABLE' | 'INSUFFICIENT_DATA';
  referenceMin?: number;
  referenceMax?: number;
  laboratoryName?: string;
  dataPoints: Array<{
    date: string;
    value: number;
    unit?: string;
  }>;
}

export interface ResultExplanationContext {
  resultId: string;
  parameterCode: string;
  parameterName: string;
  value: number;
  unit?: string;
  date: string;
  referenceMin?: number;
  referenceMax?: number;
  laboratoryName?: string;
  testTypeName: string;
  previousValues?: Array<{
    date: string;
    value: number;
  }>;
}

export interface GeneralInfoContext {
  parameterCode: string;
  parameterName: string;
  unit?: string;
  category: string;
}

@Injectable()
export class AIPromptBuilder {
  buildSystemPrompt(): string {
    return SYSTEM_PROMPT;
  }

  buildTrendSummaryContext(context: TrendContext): string {
    let contextStr = `Parameter: ${context.parameterName} (${context.parameterCode})
Unit: ${context.unit || 'not specified'}
Latest Value: ${context.latestValue} ${context.unit || ''} (${context.latestDate})`;

    if (context.previousValue !== undefined) {
      contextStr += `\nPrevious Value: ${context.previousValue} ${context.unit || ''} (${context.previousDate || 'unknown'})`;
      if (context.absoluteChange !== undefined) {
        contextStr += `\nChange: ${context.absoluteChange >= 0 ? '+' : ''}${context.absoluteChange.toFixed(2)}`;
      }
      if (context.percentageChange !== undefined) {
        contextStr += ` (${context.percentageChange >= 0 ? '+' : ''}${context.percentageChange.toFixed(1)}%)`;
      }
    }

    contextStr += `\nTrend: ${context.trend}`;

    if (context.referenceMin !== undefined && context.referenceMax !== undefined) {
      contextStr += `\nReference Range: ${context.referenceMin} – ${context.referenceMax} ${context.unit || ''} (provided by ${context.laboratoryName || 'the laboratory'})`;
    }

    if (context.dataPoints.length > 0) {
      contextStr += '\n\nHistorical Values:';
      for (const point of context.dataPoints.slice(-10)) {
        contextStr += `\n- ${point.date}: ${point.value} ${point.unit || ''}`;
      }
    }

    return contextStr;
  }

  buildResultExplanationContext(context: ResultExplanationContext): string {
    let contextStr = `Test: ${context.testTypeName}
Parameter: ${context.parameterName} (${context.parameterCode})
Recorded Value: ${context.value} ${context.unit || ''}
Date: ${context.date}
Laboratory: ${context.laboratoryName || 'Unknown'}`;

    if (context.referenceMin !== undefined && context.referenceMax !== undefined) {
      contextStr += `\nReference Range: ${context.referenceMin} – ${context.referenceMax} ${context.unit || ''} (provided by ${context.laboratoryName || 'the laboratory'})`;
    }

    if (context.previousValues && context.previousValues.length > 0) {
      contextStr += '\n\nPrevious Measurements:';
      for (const prev of context.previousValues.slice(-5)) {
        contextStr += `\n- ${prev.date}: ${prev.value} ${context.unit || ''}`;
      }
    }

    return contextStr;
  }

  buildGeneralInfoContext(context: GeneralInfoContext): string {
    return `Parameter: ${context.parameterName} (${context.parameterCode})
Category: ${context.category}
Unit: ${context.unit || 'varies'}`;
  }

  buildUserPrompt(type: InsightType, contextStr: string): string {
    let promptTemplate: string;

    switch (type) {
      case InsightType.TREND_SUMMARY:
        promptTemplate = TREND_SUMMARY_PROMPT;
        break;
      case InsightType.RESULT_EXPLANATION:
        promptTemplate = RESULT_EXPLANATION_PROMPT;
        break;
      case InsightType.DATA_CHANGE:
        promptTemplate = DATA_CHANGE_PROMPT;
        break;
      case InsightType.GENERAL_HEALTH_INFORMATION:
        promptTemplate = GENERAL_INFO_PROMPT;
        break;
      case InsightType.QUESTION_SUGGESTION:
        promptTemplate = QUESTION_SUGGESTION_PROMPT;
        break;
      default:
        promptTemplate = TREND_SUMMARY_PROMPT;
    }

    return promptTemplate.replace('{context}', contextStr);
  }

  buildChatPrompt(contextStr: string, userQuestion: string): string {
    return CHAT_PROMPT.replace('{context}', contextStr).replace('{question}', userQuestion);
  }

  getPromptVersionForType(type: string): PromptVersion {
    switch (type) {
      case 'TREND_SUMMARY':
      case 'DATA_CHANGE':
        return AI_PROMPT_VERSIONS.healthTrendAnalysis;
      case 'RESULT_EXPLANATION':
        return AI_PROMPT_VERSIONS.healthTestAnalysis;
      case 'GENERAL_HEALTH_INFORMATION':
        return AI_PROMPT_VERSIONS.generalInfo;
      case 'QUESTION_SUGGESTION':
        return AI_PROMPT_VERSIONS.questionSuggestion;
      case 'DONATION_INSIGHT':
        return AI_PROMPT_VERSIONS.donationInsight;
      case 'APPOINTMENT_INSIGHT':
        return AI_PROMPT_VERSIONS.appointmentInsight;
      case 'HEALTH_SUMMARY':
        return AI_PROMPT_VERSIONS.healthSummary;
      default:
        return AI_PROMPT_VERSIONS.healthSummary;
    }
  }

  getChatPromptVersion(): PromptVersion {
    return AI_PROMPT_VERSIONS.healthChat;
  }
}
