# AI Operations Guide

## Monitoring

### Admin Dashboard

Navigate to **AI Analytics** in the admin panel to view:
- Total requests and success rate
- Average latency
- Safety blocks count
- Requests by feature type
- Feedback analytics (helpful/not helpful rates)
- 7-day request trend
- Total tokens and estimated cost
- Fallback usage count

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| Success Rate | > 95% | < 90% |
| Average Latency | < 5000ms | > 10000ms |
| Fallback Rate | < 5% | > 10% |
| Safety Block Rate | < 10% | > 20% |

## Troubleshooting

### AI Provider Failure

1. Check `AI_API_KEY` is configured
2. Check `AI_ENABLED` is set to `true`
3. Verify network connectivity to AI provider
4. The system automatically falls back to deterministic responses
5. Users see "AI insights are temporarily unavailable"

### High Error Rate

1. Check AI analytics in admin panel
2. Review error messages in `AIRequestLog`
3. Check rate limiting configuration
4. Verify provider API status

### Cache Issues

- Cache is automatically invalidated when data changes
- Manual cache invalidation: call `invalidateUserCache(userId)`
- Clean expired cache: `cleanupExpired()`

## Cost Management

- Token usage is tracked in `AIRequestLog`
- Estimated cost is calculated at $0.00015 per 1K tokens
- Admin dashboard shows running cost estimates
- Model configuration controls max tokens

## Data Cleanup

Periodic cleanup jobs should run:
- `AIInsightHistoryService.deleteExpiredInsights()` - removes expired insights
- `AICacheService.cleanupExpired()` - removes expired cache entries
- `AIRequestLogService.cleanupOldLogs()` - removes logs older than 90 days
- `AIConversationService.cleanupExpired()` - removes expired conversations

## Feature Toggle

AI features are controlled by the `AI_ENABLED` environment variable:
- `false` (default) - All AI endpoints return 403
- `true` - AI features are active

When disabling AI features:
1. Set `AI_ENABLED=false`
2. All existing insights remain viewable
3. New AI generation is blocked
4. Chat is disabled
5. The Health Dashboard continues to work normally

## Incident Response

If unsafe AI content is detected:
1. Review the affected insight in admin panel
2. Check `AIRequestLog` for request details
3. Review safety patterns - are they sufficient?
4. Add new safety patterns if needed
5. Update prompt version if systemic issue
6. Document the incident
