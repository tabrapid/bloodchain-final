# AI Health Intelligence Platform

## Overview

The BloodChain includes a production-grade AI Health Intelligence system that provides donors with informational insights about their health data. The AI helps donors understand blood test results, trends, donation patterns, and prepares questions for healthcare professionals.

**Important:** The AI is an **INFORMATIONAL ASSISTANT ONLY**. It does not diagnose, prescribe, or replace healthcare professionals.

## Architecture

```
┌─────────────────┐
│  AI Controller   │  REST API endpoints
└────────┬────────┘
         │
┌────────▼────────┐
│  AI Health       │  Orchestration service
│  Service         │  - Feature checks
│                  │  - Input sanitization
│                  │  - Safety classification
│                  │  - Deduplication
│                  │  - Audit logging
└────────┬────────┘
         │
┌────────▼────────┐
│  Context         │  Builds minimal health context
│  Builder         │  - Blood tests
│                  │  - Trends
│                  │  - Donations
│                  │  - Appointments
└────────┬────────┘
         │
┌────────▼────────┐
│  Prompt          │  Constructs versioned prompts
│  Builder         │  - System instructions
│                  │  - Safety instructions
│                  │  - Context injection
└────────┬────────┘
         │
┌────────▼────────┐
│  AI Provider     │  Provider abstraction
│  Factory         │  - Primary: OpenAI
│                  │  - Fallback: Deterministic
│                  │  - Model config
└────────┬────────┘
         │
┌────────▼────────┐
│  Response        │  Parses and validates output
│  Service         │  - JSON validation
│                  │  - Schema enforcement
│                  │  - Safety output check
└────────┬────────┘
         │
┌────────▼────────┐
│  Safety          │  Output validation
│  Layer           │  - Pattern matching
│                  │  - Hallucination detection
│                  │  - Safe fallback
└────────┬────────┘
         │
┌────────▼────────┐
│  Persistence     │  Stores results
│  Layer           │  - AIInsight (history)
│                  │  - AIRequestLog (analytics)
│                  │  - AIInsightCache (dedup)
│                  │  - AIConversation (chat)
│                  │  - AIFeedback (user feedback)
└─────────────────┘
```

## Key Components

### Provider Abstraction

- **Interface:** `AIProvider` - defines `generate()` method
- **Primary:** `OpenAIProvider` - connects to OpenAI API
- **Fallback:** `AIFallbackProvider` - deterministic safe response
- **Factory:** `AIProviderFactory` - handles primary + fallback with graceful degradation

### Context Builder

Two context builders:

1. **AIContextBuilder** - builds context for specific analysis types:
   - Trend context (parameter, values, dates, reference ranges)
   - Result explanation context (test items, previous values)
   - General info context (parameter metadata)
   - User health summary

2. **AIContextBuilderService (Enhanced)** - builds comprehensive context:
   - Donation history and patterns
   - Appointment history and upcoming
   - Blood test overview

### Prompt Versioning

All prompts are versioned for auditability and safe updates:

| Key | Version | Purpose |
|-----|---------|---------|
| `healthTestAnalysis` | `health-test-analysis-v1` | Individual blood test explanation |
| `healthTrendAnalysis` | `health-trend-analysis-v1` | Trend analysis |
| `healthSummary` | `health-summary-v1` | Comprehensive health summary |
| `healthChat` | `health-chat-v1` | Chat assistant |
| `donationInsight` | `donation-insight-v1` | Donation pattern insights |
| `appointmentInsight` | `appointment-insight-v1` | Appointment summary |
| `generalInfo` | `general-info-v1` | General educational info |
| `questionSuggestion` | `question-suggestion-v1` | Questions for professionals |

Version is stored with every insight and request log for auditing.

### Deduplication

Two-level deduplication:

1. **Request fingerprint dedup:** SHA-256 hash of (userId + insightType + contextData + promptVersion). If identical request was successful recently, returns cached result.

2. **Inflight dedup:** Prevents concurrent identical requests from hitting the AI provider simultaneously.

### Caching

Database-backed cache (`AIInsightCache`) with:
- 24-hour default TTL
- Keyed by (userId + insightType + dataVersion)
- Auto-cleanup of expired entries

### Safety Layer

Multi-layer safety system:

1. **Input Classification:** Pattern matching for unsafe requests (diagnosis, prescription, emergency)
2. **Output Validation:** Pattern matching for unsafe AI output
3. **Emergency Detection:** Self-harm, severe symptoms
4. **Safe Fallbacks:** Pre-written safe responses for out-of-scope requests
5. **Confidence Rejection:** Detects fabricated confidence percentages

Safety levels:
- `SAFE_INFORMATIONAL` - Safe educational content
- `NEEDS_CONTEXT` - Needs healthcare professional context
- `PROFESSIONAL_REVIEW_SUGGESTED` - Unusual patterns
- `EMERGENCY_REDIRECT` - Immediate help needed
- `OUT_OF_SCOPE` - Beyond AI assistant capabilities

### Feedback System

Users can rate insights:
- `HELPFUL` / `NOT_HELPFUL` / `REPORT_ISSUE`
- One feedback per insight
- Aggregate analytics available for admin

### Conversations

AI chat supports persistent conversations:
- 90-day retention with auto-expiry
- Max 50 messages per conversation
- Context type tracking (GENERAL, TREND, RESULT, etc.)

## API Endpoints

### User Endpoints (`/api/v1/me/ai`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/insights` | Generate AI health insight |
| POST | `/explain-result` | Explain specific lab result |
| POST | `/analyze-trend` | Analyze parameter trend |
| POST | `/chat` | AI health chat |
| POST | `/donation-insight` | Donation history insight |
| POST | `/appointment-insight` | Appointment summary |
| POST | `/health-summary` | Comprehensive summary |
| POST | `/feedback` | Submit feedback on insight |
| GET | `/history` | Insight history |
| GET | `/history/:id` | Specific insight |
| DELETE | `/history/:id` | Delete insight |
| GET | `/conversations` | Chat conversations |
| GET | `/conversations/:id` | Conversation detail |
| DELETE | `/conversations/:id` | Delete conversation |

### Admin Endpoints (`/api/v1/admin/ai`) - SUPER_ADMIN only

| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics` | Platform AI analytics |
| GET | `/insight-stats` | Insight statistics |

## Database Models

| Model | Purpose |
|-------|---------|
| `AIInsight` | Stored AI-generated insights |
| `AIRequestLog` | Request analytics and monitoring |
| `AIInsightCache` | Response caching |
| `AIConversation` | Chat conversations |
| `AIMessage` | Chat messages |
| `AIFeedback` | User feedback on insights |

## Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_ENABLED` | Enable/disable AI features | `false` |
| `AI_API_KEY` | OpenAI API key (server only) | - |
| `AI_MODEL` | Default model | `gpt-4o-mini` |
| `AI_BASE_URL` | API base URL | OpenAI default |
| `AI_MAX_TOKENS` | Max response tokens | `1000` |
| `AI_TIMEOUT_MS` | Request timeout | `30000` |

## Security

- API keys never exposed to client
- All endpoints require JWT authentication
- Ownership verification on all data access
- Donor A cannot access Donor B's insights
- Audit logging for all AI operations
- Rate limiting via existing throttler

## Data Retention

| Data Type | Retention |
|-----------|-----------|
| AI Insights | Until user deletes |
| AI Request Logs | 90 days |
| AI Conversations | 90 days (auto-expire) |
| AI Cache | 24 hours (auto-expire) |
