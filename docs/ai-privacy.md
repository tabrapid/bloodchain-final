# AI Privacy & Data Protection

## Data Minimization

The AI system follows strict data minimization principles:

### What is NOT Sent to AI
- Full name
- Phone number
- Email address
- Physical address
- Precise location
- Organization-private metadata
- Unrelated identifiers
- Community activity
- Gamification data

### What is Sent to AI (Context-Specific)
The system only sends data relevant to the requested analysis:

**Blood Test Analysis:**
- Test parameter name, code, unit
- Recorded value and date
- Laboratory reference range
- Previous values for same parameter
- Laboratory name

**Trend Analysis:**
- Parameter name, code, unit
- Historical values with dates
- Trend direction (calculated deterministically)
- Reference range
- Change metrics (calculated deterministically)

**Health Summary:**
- Aggregate counts (total tests, donations, appointments)
- Parameter names and latest values
- Dates only (no personal identifiers)

**Chat:**
- Minimal health summary
- User's specific question (sanitized)

## Reference Range Integrity

The AI **never invents** reference ranges. It only uses ranges stored with laboratory results. If no reference range is available, the AI states: "The reference range is not available, so interpretation is limited."

## AI-Generated Content Boundaries

The AI:
- Does NOT determine medical eligibility
- Does NOT override laboratory reference ranges
- Does NOT override clinician instructions
- Does NOT encourage unsafe donation
- Does NOT encourage donation while unwell

## Data Retention

| Data Type | Retention Policy |
|-----------|-----------------|
| AI Insights | Until user deletes |
| AI Conversations | 90 days, then auto-delete |
| AI Request Logs | 90 days, then auto-delete |
| AI Cache | 24 hours, then auto-delete |
| AI Feedback | Retained for analytics |

## Data Deletion

When health data is deleted:
- Associated AI insights remain until their expiry
- AI request logs follow their own retention schedule
- No cascading delete from AI data to source data

## Consent

Users must explicitly enable AI features via the `AI_ENABLED` configuration. The platform respects user notification preferences for AI-related notifications.
