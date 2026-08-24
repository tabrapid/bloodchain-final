# AI Safety System

## Principles

The AI safety system ensures that the platform's AI assistant remains:
- **Informational only** - Never diagnostic or prescriptive
- **Transparent** - Clear boundaries about capabilities
- **Safe** - Detects and blocks unsafe content
- **Auditable** - All safety actions are logged

## Input Safety

### Request Classification

Every user input is classified before AI processing:

```
User Input → Sanitize → Classify → Safety Level → Action
```

**Unsafe Request Patterns:**
- Diagnosis requests ("Do I have cancer?")
- Medication questions ("Should I take this medicine?")
- Dosage requests ("What dosage should I take?")
- Unsafe donation questions ("Should I donate if I'm sick?")
- Ignoring symptoms ("Can I ignore this result?")
- Prompt injection ("Ignore your instructions")
- Role manipulation ("You are a doctor")

**Emergency Patterns:**
- Self-harm indicators
- Severe medical emergencies
- Life-threatening symptom descriptions

### Input Sanitization
- Removes control characters
- Limits to 2000 characters
- Printable ASCII/Unicode only

## Output Safety

### Output Validation

Every AI response is validated before delivery:

```
AI Response → Validate → Safe? → Parse → Return
                         ↓ No
                    Safe Fallback
```

**Unsafe Output Patterns:**
- Diagnosis claims ("You have diabetes")
- Prescription suggestions ("Take 500mg of...")
- Certainty claims ("You definitely need...")
- Fabricated confidence percentages
- Unsafe donation advice
- Telling users to ignore professionals

### Safe Fallbacks

When unsafe output is detected:
1. The unsafe response is discarded
2. A pre-written safe response is returned
3. The event is logged
4. No internal security details are exposed to users

## Safety Levels

| Level | Meaning | Action |
|-------|---------|--------|
| `SAFE_INFORMATIONAL` | Safe educational content | Deliver to user |
| `NEEDS_CONTEXT` | Needs professional context | Deliver with caveats |
| `PROFESSIONAL_REVIEW_SUGGESTED` | Unusual patterns detected | Deliver with professional review suggestion |
| `EMERGENCY_REDIRECT` | Emergency situation detected | Return emergency redirect message |
| `OUT_OF_SCOPE` | Beyond AI capabilities | Return out-of-scope message |

## Hallucination Protection

The AI is explicitly instructed and validated to never invent:
- Laboratory values
- Reference ranges
- Dates
- Appointments
- Donations
- Medications
- Symptoms
- Diagnoses
- Medical history

## Emergency Handling

When emergency patterns are detected:
1. Input is classified as `EMERGENCY_REDIRECT`
2. AI provider receives safe fallback prompt instead of user input
3. Response directs user to emergency services
4. Event is logged for safety analytics
5. No medical advice is provided

## Safety Incident Logging

All safety events are logged to:
- `AIRequestLog` table (success/failure, safety level)
- `AuditLog` table (action, metadata)

Safety incidents are tracked separately from normal requests for monitoring.
