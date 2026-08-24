# AI Prompt System

## Versioning Strategy

All prompts are versioned to enable safe updates and auditing. The version format is: `{purpose}-v{number}`.

Current versions are defined in `prompts/prompt-versions.ts`.

### Prompt Types

1. **System Prompt** - Always sent; defines AI role, boundaries, and output format
2. **Task Prompts** - Specific to each analysis type
3. **Chat Prompt** - For conversational interactions

### Structure

```
System Prompt (fixed boundaries)
    +
Task-Specific Prompt (context-dependent)
    +
Structured Context (data-minimized)
    +
User Question (if applicable, sanitized)
```

### Adding a New Prompt Version

1. Add the prompt template in `prompts/system.ts`
2. Add version key in `prompts/prompt-versions.ts`
3. Update `getPromptVersionForType()` in `prompt-builder.ts`
4. Increment the version number (v1 → v2)

### Prompt Template Variables

Prompts use `{context}` and `{question}` placeholders that are replaced by the prompt builder. These should never be uncontrolled string concatenations.

### Output Format Requirement

All prompts require JSON output matching this structure:
```json
{
  "title": "Brief title",
  "summary": "1-2 sentence plain language summary",
  "observations": ["Observation 1"],
  "dataPoints": [{"label": "Label", "value": "Value"}],
  "caveats": ["Caveat 1"],
  "questionsForProfessional": ["Question 1"],
  "safetyLevel": "SAFE_INFORMATIONAL",
  "type": "TREND_SUMMARY"
}
```
