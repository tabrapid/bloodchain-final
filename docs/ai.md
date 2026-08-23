# AI Health Insights Architecture

## Overview

The AI Health module provides a safe, data-grounded AI assistant that analyzes laboratory results and health trends without providing medical diagnoses or treatment recommendations.

## Architecture

```
Mobile App
    ↓
Backend API (authenticated)
    ↓
AI Health Controller
    ↓
AI Health Service (orchestration)
    ↓
├── AI Context Builder (data aggregation)
├── AI Safety Service (validation)
├── AI Response Service (LLM interaction)
└── AI Prompt Builder (structured prompts)
    ↓
LLM Provider (OpenAI)
```

## Key Principles

1. **AI never accesses database directly** - All data access goes through controlled context builder
2. **Structured output only** - AI responses are validated against strict JSON schemas
3. **Safety layer** - Both requests and responses are validated for unsafe content
4. **No medical claims** - System explicitly prohibits diagnosis, prescription, or treatment recommendations
5. **User isolation** - All queries are scoped to authenticated user only

## Modules

### AI Provider Abstraction (`providers/`)

```typescript
interface AIProvider {
  name: string;
  generate(messages: AIProviderMessage[], options?: AIProviderOptions): Promise<AIProviderResponse>;
}
```

Currently implemented:
- **OpenAIProvider** - Uses OpenAI Chat API with structured JSON output

### AI Safety Service

- **Request classification** - Classifies incoming requests into safety levels
- **Output validation** - Validates AI responses for prohibited content
- **Safe fallbacks** - Returns safe responses when requests are out of scope

Safety Levels:
- `SAFE_INFORMATIONAL` - General educational content
- `NEEDS_CONTEXT` - Requires healthcare professional context
- `PROFESSIONAL_REVIEW_SUGGESTED` - Recommend professional consultation
- `EMERGENCY_REDIRECT` - Urgent safety redirect
- `OUT_OF_SCOPE` - Cannot help with this request

### AI Context Builder

Constructs sanitized context for AI requests:

- Fetches only authorized user data
- Removes PII (names, emails, addresses)
- Validates unit compatibility
- Groups compatible data points
- Limits context window size

### AI Response Service

- Calls LLM provider with structured prompts
- Parses and validates JSON responses
- Schema validation with fallback
- Error handling and retry logic

## Prompt Management

Centralized prompt templates in `prompts/`:

- `system.ts` - System prompt defining AI role and safety rules
- `prompt-builder.ts` - Context-specific prompt construction

### System Prompt Rules

The AI is instructed to:
- Never diagnose or prescribe
- Use only provided data
- State uncertainty when appropriate
- Attribute reference ranges to laboratories
- Encourage professional consultation

## Structured Response Schema

```typescript
interface AiInsightResponse {
  id: string;
  type: InsightType;
  title: string;
  summary: string;
  observations: string[];
  dataPoints?: DataPoint[];
  caveats: string[];
  questionsForProfessional?: string[];
  safetyLevel: SafetyLevel;
  generatedAt: string;
  dataVersion?: string;
  dataReferences?: DataReference[];
}
```

Insight Types:
- `TREND_SUMMARY` - Trend analysis over time
- `RESULT_EXPLANATION` - Explanation of specific result
- `DATA_CHANGE` - Changes between measurements
- `REFERENCE_RANGE_CONTEXT` - Reference range information
- `GENERAL_HEALTH_INFORMATION` - Educational content
- `QUESTION_SUGGESTION` - Questions for healthcare provider
- `DATA_QUALITY_WARNING` - Data quality concerns

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/me/ai/insights` | Generate AI insight |
| POST | `/api/v1/me/ai/explain-result` | Explain specific result |
| POST | `/api/v1/me/ai/analyze-trend` | Analyze parameter trend |
| POST | `/api/v1/me/ai/chat` | Chat with AI assistant |

## Environment Variables

```env
AI_ENABLED=true
AI_PROVIDER=openai
AI_MODEL=gpt-4o-mini
AI_API_KEY=your-api-key
AI_BASE_URL=https://api.openai.com/v1
AI_TIMEOUT_MS=30000
AI_MAX_TOKENS=1000
AI_RATE_LIMIT=10
```

## Privacy & Security

- All AI endpoints require authentication
- User identity derived from JWT, never from request parameters
- PII minimized in AI context
- No data shared between users
- AI provider secrets stored server-side only
- Rate limiting on AI requests

## Limitations

- Does not diagnose conditions
- Does not prescribe or recommend medication
- Does not provide treatment recommendations
- Does not predict disease outcomes
- Does not replace healthcare professionals
- May not recognize all medical emergencies

## Future Enhancements

- Consent management with audit trail
- Conversation persistence with retention limits
- Multi-language support
- Additional AI providers (Anthropic, etc.)
- Cost monitoring and budgeting
