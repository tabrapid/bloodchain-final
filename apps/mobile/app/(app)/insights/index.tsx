import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import {
  Activity,
  AlertTriangle,
  Brain,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  Shield,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
} from 'lucide-react-native';
import {
  Badge,
  Banner,
  Button,
  Field,
  ListGroup,
  ListRow,
  Row,
  ScreenHeader,
  SectionHeader,
  Skeleton,
  Stack,
  Surface,
  Text,
  Well,
  iconSize,
  radius,
  space,
  useDesign,
  type StatusTone,
  FormScreen,
} from '../../../src/design';
import { LucideIcon } from '../../../src/types/icons';
import {
  analyzeTrend,
  generateInsight,
  getAiAvailability,
  getInsightHistory,
  InsightType,
  SafetyLevel,
  sendChatMessage,
  submitFeedback,
  FeedbackType,
  type AiAvailability,
  type AiInsight,
  type ChatResponse,
} from '../../../src/api/ai-health';
import { getAvailableParameters, type AvailableParameter } from '../../../src/api/health-trends';
import { useTranslation } from '../../../src/i18n';

/**
 * Each insight kind gets an icon keyed to what it is. Only the icon lives
 * here: the wording is a catalogue key resolved at render, because a label
 * built at module load has no locale to be built in.
 */
const TYPE_ICON: Record<InsightType, LucideIcon> = {
  [InsightType.TREND_SUMMARY]: TrendingUp,
  [InsightType.RESULT_EXPLANATION]: Lightbulb,
  [InsightType.DATA_CHANGE]: Activity,
  [InsightType.REFERENCE_RANGE_CONTEXT]: Shield,
  [InsightType.GENERAL_HEALTH_INFORMATION]: Brain,
  [InsightType.QUESTION_SUGGESTION]: HelpCircle,
  [InsightType.DATA_QUALITY_WARNING]: AlertTriangle,
};

/**
 * The reference ends each insight card with a "94% confidence" meter. Nothing
 * in this system produces a confidence number, and inventing one on health
 * content would be the worst possible place to fake a number -- so the card
 * ends with the insight's real `safetyLevel` instead, which is the field that
 * actually tells a donor how far to trust what they just read.
 */
function safetyTone(level: SafetyLevel): StatusTone {
  switch (level) {
    case SafetyLevel.SAFE_INFORMATIONAL:
      return 'success';
    case SafetyLevel.NEEDS_CONTEXT:
    case SafetyLevel.PROFESSIONAL_REVIEW_SUGGESTED:
      return 'warning';
    case SafetyLevel.EMERGENCY_REDIRECT:
      return 'critical';
    default:
      return 'neutral';
  }
}

export default function InsightsScreen() {
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [latestInsight, setLatestInsight] = useState<AiInsight | null>(null);
  const [history, setHistory] = useState<AiInsight[]>([]);
  const [availableParams, setAvailableParams] = useState<AvailableParameter[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [chatResponse, setChatResponse] = useState<ChatResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<string | null>(null);
  /**
   * Whether this deployment has AI switched on at all.
   *
   * `undefined` until the answer arrives: drawing the buttons as available and
   * then disabling them a moment later is worse than waiting, and drawing them
   * as unavailable first would flash a wrong state at everyone.
   */
  const [aiAvailability, setAiAvailability] = useState<AiAvailability | undefined>(undefined);

  const loadData = useCallback(async () => {
    try {
      const [availability, params, historyResult] = await Promise.all([
        // A failure here is treated as "off": offering a button that cannot
        // work is the thing this is here to prevent.
        getAiAvailability().catch(
          (): AiAvailability => ({ enabled: false, reason: 'DEPLOYMENT' }),
        ),
        getAvailableParameters(),
        getInsightHistory({ limit: 10 }).catch(() => ({ insights: [], total: 0 })),
      ]);
      setAiAvailability(availability);
      setAvailableParams(params);
      setHistory(historyResult.insights);
      setError(null);
    } catch {
      setError(t('insights.unavailable'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
    // `t` is stable per locale and re-running this on a language change would
    // refetch the whole screen for a word.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    setLatestInsight(null);
    setFeedbackGiven(null);
    loadData();
  }, [loadData]);

  const runGeneration = useCallback(async (generator: () => Promise<AiInsight>) => {
    setIsGenerating(true);
    setError(null);
    setFeedbackGiven(null);
    try {
      const insight = await generator();
      setLatestInsight(insight);
      // A newly generated insight belongs in the history list too, without a
      // second round trip to fetch what we already hold.
      setHistory((previous) => [insight, ...previous.filter((i) => i.id !== insight.id)]);
    } catch {
      setError(t('insights.unavailable'));
    } finally {
      setIsGenerating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFeedback = useCallback(async (insightId: string, type: FeedbackType) => {
    try {
      await submitFeedback({ insightId, type });
      setFeedbackGiven(insightId);
    } catch {
      setError(t('insights.feedbackFailed'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChat = useCallback(async () => {
    if (!chatMessage.trim()) return;
    setIsGenerating(true);
    setError(null);
    setFeedbackGiven(null);
    try {
      const response = await sendChatMessage({ message: chatMessage });
      setChatResponse(response);
      if (response.message.insight) setLatestInsight(response.message.insight);
      setChatMessage('');
    } catch {
      setError(t('insights.chatUnavailable'));
    } finally {
      setIsGenerating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessage]);

  // Unknown is not "off": while the answer is still in flight the buttons
  // stay enabled-looking rather than flashing a state that may be wrong.
  const aiOff = aiAvailability?.enabled === false;

  const actions = useMemo(
    () => [
      {
        key: 'results',
        icon: Brain,
        title: t('insights.analyzeResults'),
        subtitle: t('insights.analyzeResultsHint'),
        disabled: aiOff || availableParams.length === 0,
        onPress: () =>
          runGeneration(() =>
            generateInsight({
              type: InsightType.RESULT_EXPLANATION,
              parameterCode: availableParams[0]?.code,
            }),
          ),
      },
      {
        key: 'trends',
        icon: TrendingUp,
        title: t('insights.summarizeTrends'),
        subtitle: t('insights.summarizeTrendsHint'),
        disabled: aiOff || availableParams.length === 0,
        onPress: () => {
          const code = availableParams[0]?.code;
          if (!code) return;
          return runGeneration(() => analyzeTrend({ parameterCode: code }));
        },
      },
      {
        key: 'questions',
        icon: MessageSquare,
        title: t('insights.questionsToDiscuss'),
        subtitle: t('insights.questionsToDiscussHint'),
        disabled: aiOff,
        onPress: () =>
          runGeneration(() => generateInsight({ type: InsightType.QUESTION_SUGGESTION })),
      },
    ],
    [aiOff, availableParams, runGeneration, t],
  );

  return (
    // FormScreen rather than ScrollScreen: the chat field is the last block of a
    // long page, and an open keyboard covered the field, the send button and the
    // disclaimer under it.
    <FormScreen
      header={
        <ScreenHeader
          title={t('insights.title')}
          size="large"
          onBack={() => router.back()}
          backLabel={t('common.a11yGoBack')}
          actions={<Badge label={t('insights.poweredByAi')} tone="insight" dot />}
        />
      }
      refreshing={isRefreshing}
      onRefresh={onRefresh}
    >
      <Stack gap="xl">
        <Text variant="body" tone="secondary">
          {t('insights.subtitle')}
        </Text>

        {/* The standing disclaimer, above everything this screen can produce:
            informational, drawn from the donor's own recorded data, not a
            diagnosis. */}
        <Banner
          tone="neutral"
          title={t('medical.aiSafety.disclaimer')}
          icon={({ size, color }) => <Shield size={size} color={color} />}
        />

        {error ? <Banner tone="critical" title={error} /> : null}

        {aiOff ? (
          // Said once, plainly, above controls that are also disabled. A
          // deliberately switched-off feature is not "temporarily
          // unavailable", and presenting it that way invites people to keep
          // trying something that will never work.
          <Banner
            tone="warning"
            title={
              aiAvailability?.reason === 'PLATFORM'
                ? t('insights.disabledByAdmin')
                : t('insights.disabledInDeployment')
            }
            icon={({ size, color }) => <AlertTriangle size={size} color={color} />}
          />
        ) : null}

        <Stack gap="md">
          <SectionHeader title={t('insights.generate')} />
          <ListGroup
            rows={actions.map((action) => {
              const Icon = action.icon;
              const disabled = action.disabled || isGenerating;
              return (
                <ListRow
                  key={action.key}
                  icon={({ size, color }) => <Icon size={size} color={color} />}
                  iconTone={disabled ? undefined : 'insight'}
                  title={action.title}
                  subtitle={action.subtitle}
                  disabled={disabled}
                  onPress={() => void action.onPress()}
                />
              );
            })}
          />
          {isGenerating ? <Skeleton height={96} /> : null}
        </Stack>

        {latestInsight ? (
          <Stack gap="md">
            <SectionHeader title={t('insights.latest')} />
            <InsightCard insight={latestInsight} expanded>
              {feedbackGiven === latestInsight.id ? (
                <Text variant="caption" tone="success">
                  {t('insights.feedbackThanks')}
                </Text>
              ) : (
                <Stack gap="sm">
                  <Text variant="caption" tone="tertiary">
                    {t('insights.helpfulPrompt')}
                  </Text>
                  <Row gap="sm">
                    <Button
                      label={t('insights.helpful')}
                      variant="secondary"
                      size="md"
                      block={false}
                      icon={({ size, color }) => <ThumbsUp size={size} color={color} />}
                      onPress={() => void handleFeedback(latestInsight.id, FeedbackType.HELPFUL)}
                    />
                    <Button
                      label={t('insights.notHelpful')}
                      variant="secondary"
                      size="md"
                      block={false}
                      icon={({ size, color }) => <ThumbsDown size={size} color={color} />}
                      onPress={() => void handleFeedback(latestInsight.id, FeedbackType.NOT_HELPFUL)}
                    />
                  </Row>
                </Stack>
              )}
            </InsightCard>
          </Stack>
        ) : null}

        <Stack gap="md">
          <SectionHeader title={t('insights.yours')} />
          {isLoading ? (
            <Stack gap="md">
              <Skeleton height={96} />
              <Skeleton height={96} />
            </Stack>
          ) : history.filter((insight) => insight.id !== latestInsight?.id).length === 0 ? (
            <Surface level="flat">
              <Stack gap="xs">
                <Text variant="bodyMedium">{t('insights.empty')}</Text>
                <Text variant="caption" tone="secondary">
                  {availableParams.length === 0
                    ? t('insights.emptyNoData')
                    : t('insights.emptyHasData')}
                </Text>
              </Stack>
            </Surface>
          ) : (
            <Stack gap="md">
              {history
                .filter((insight) => insight.id !== latestInsight?.id)
                .map((insight) => (
                  <InsightCard
                    key={insight.id}
                    insight={insight}
                    onPress={() => setLatestInsight(insight)}
                  />
                ))}
            </Stack>
          )}
        </Stack>

        <Stack gap="md">
          <SectionHeader title={t('insights.askAbout')} />
          <Surface level="flat">
            <Stack gap="md">
              <Field
                label={t('insights.askAbout')}
                placeholder={t('insights.askPlaceholder')}
                value={chatMessage}
                onChangeText={setChatMessage}
                editable={!aiOff}
                multiline
              />
              <Button
                label={isGenerating ? t('common.sending') : t('insights.send')}
                loading={isGenerating}
                disabled={aiOff || !chatMessage.trim()}
                onPress={() => void handleChat()}
              />
              {chatResponse ? (
                <Well>
                  <Stack gap="xs">
                    <Text variant="overline" tone="tertiary" caps>
                      {t('insights.response')}
                    </Text>
                    <Text variant="body">{chatResponse.message.content}</Text>
                    {/* An answer is still AI-written, and it is read furthest
                        from the banner at the top of the screen. */}
                    <Text variant="caption" tone="tertiary">
                      {t('medical.advice.notMedicalAdvice')}
                    </Text>
                  </Stack>
                </Well>
              ) : null}
            </Stack>
          </Surface>
        </Stack>
      </Stack>
    </FormScreen>
  );
}

function InsightCard({
  insight,
  expanded = false,
  onPress,
  children,
}: {
  insight: AiInsight;
  expanded?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
}) {
  const { t, formatDate } = useTranslation();
  const { colors } = useDesign();
  const type = TYPE_ICON[insight.type] ? insight.type : InsightType.GENERAL_HEALTH_INFORMATION;
  const Icon = TYPE_ICON[type];

  return (
    <Surface
      {...(onPress ? { onPress, accessibilityLabel: insight.title } : {})}
    >
      <Stack gap="md">
        <Row gap="md" align="flex-start">
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.insight.soft,
            }}
          >
            <Icon size={iconSize.md} color={colors.insight.base} />
          </View>
          <View style={{ flex: 1, gap: space.xs }}>
            <Text variant="title">{insight.title}</Text>
            <Row gap="xs" style={{ flexWrap: 'wrap' }}>
              <Badge label={t(`medical.aiInsightTypes.${type}`)} tone="insight" />
              <Badge
                label={t(`medical.aiSafety.${insight.safetyLevel}`)}
                tone={safetyTone(insight.safetyLevel)}
              />
            </Row>
          </View>
        </Row>

        <Text variant="body" tone="secondary">
          {insight.summary}
        </Text>

        {expanded && insight.observations.length > 0 ? (
          <Stack gap="xs">
            {insight.observations.map((observation) => (
              <Text key={observation} variant="caption" tone="secondary">
                {`• ${observation}`}
              </Text>
            ))}
          </Stack>
        ) : null}

        {expanded && insight.dataPoints && insight.dataPoints.length > 0 ? (
          <Well>
            <Stack gap="xs">
              <Text variant="overline" tone="tertiary" caps>
                {t('insights.referencedData')}
              </Text>
              {insight.dataPoints.map((point) => (
                <Row key={`${point.label}-${point.value}`} gap="md">
                  <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                    {point.label}
                  </Text>
                  <Text variant="caption">
                    {point.value}
                    {point.unit ? ` ${point.unit}` : ''}
                  </Text>
                </Row>
              ))}
            </Stack>
          </Well>
        ) : null}

        {expanded &&
        insight.questionsForProfessional &&
        insight.questionsForProfessional.length > 0 ? (
          <Stack gap="xs">
            <Text variant="label" tone="secondary">
              {t('medical.advice.askYourProvider')}
            </Text>
            {insight.questionsForProfessional.map((question) => (
              <Text key={question} variant="caption" tone="secondary">
                {`• ${question}`}
              </Text>
            ))}
          </Stack>
        ) : null}

        {expanded && insight.caveats.length > 0 ? (
          <Stack gap="xs">
            {insight.caveats.map((caveat) => (
              <Text key={caveat} variant="caption" tone="warning">
                {caveat}
              </Text>
            ))}
          </Stack>
        ) : null}

        <Text variant="caption" tone="tertiary">
          {formatDate(insight.generatedAt, 'medium')}
        </Text>

        {children}
      </Stack>
    </Surface>
  );
}
