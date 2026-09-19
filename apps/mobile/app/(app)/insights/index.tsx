import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Brain,
  ChevronRight,
  Lightbulb,
  MessageSquare,
  Shield,
  TrendingUp,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  Activity,
  type LucideIcon,
} from 'lucide-react-native';
import {
  AppButton,
  AppText,
  AppTextInput,
  Badge,
  GlassCard,
  Screen,
  SectionHeader,
  SkeletonCard,
} from '../../../src/components';
import { layout, spacing, radius, useTheme, type ThemeColors } from '../../../src/theme';
import {
  generateInsight,
  analyzeTrend,
  sendChatMessage,
  submitFeedback,
  getInsightHistory,
  InsightType,
  SafetyLevel,
  type AiInsight,
  type ChatResponse,
  FeedbackType,
  getAiAvailability,
  type AiAvailability,
} from '../../../src/api/ai-health';
import { getAvailableParameters, type AvailableParameter } from '../../../src/api/health-trends';
import type { BadgeProps } from '../../../src/components/Badge';
import { useTranslation } from '../../../src/i18n';

/**
 * Each insight kind gets the reference's icon square, keyed to what it is.
 * Only the icon lives here: the wording is a catalogue key resolved at render,
 * because a label built at module load has no locale to be built in.
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
function safetyVariant(level: SafetyLevel): BadgeProps['variant'] {
  switch (level) {
    case SafetyLevel.SAFE_INFORMATIONAL:
      return 'success';
    case SafetyLevel.NEEDS_CONTEXT:
    case SafetyLevel.PROFESSIONAL_REVIEW_SUGGESTED:
      return 'warning';
    case SafetyLevel.EMERGENCY_REDIRECT:
      return 'danger';
    default:
      return 'default';
  }
}

export default function InsightsScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
    } catch {
      setError(t('insights.unavailable'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
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
  }, []);

  const handleFeedback = useCallback(async (insightId: string, type: FeedbackType) => {
    try {
      await submitFeedback({ insightId, type });
      setFeedbackGiven(insightId);
    } catch {
      setError(t('insights.feedbackFailed'));
    }
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
    <Screen scroll={false} style={styles.screen}>
      <LinearGradient
        colors={[
          isDark ? 'rgba(142, 130, 223, 0.20)' : 'rgba(142, 130, 223, 0.14)',
          'transparent',
        ]}
        style={styles.headerBlock}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={({ pressed }) => [styles.backLink, { opacity: pressed ? 0.6 : 1 }]}
        >
          <ArrowLeft size={16} color={colors.ai} strokeWidth={2.5} />
          <AppText style={styles.backLabel}>{t('common.back')}</AppText>
        </Pressable>

        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <Brain size={22} color={colors.onMuted.ai} />
          </View>
          <View style={styles.headerText}>
            <View style={styles.headerTitleLine}>
              <AppText style={styles.headerTitle}>{t('insights.title')}</AppText>
              <Badge variant="ai">{t('insights.poweredByAi')}</Badge>
            </View>
            <AppText style={styles.headerSubtitle}>{t('insights.subtitle')}</AppText>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.ai} />
        }
      >
        <GlassCard style={styles.disclaimer}>
          <View style={styles.disclaimerRow}>
            <Shield size={16} color={colors.onMuted.secondary} />
            <AppText style={styles.disclaimerText}>{t('medical.aiSafety.disclaimer')}</AppText>
          </View>
        </GlassCard>

        {error && (
          <GlassCard danger>
            <View style={styles.disclaimerRow}>
              <AlertTriangle size={16} color={colors.onMuted.danger} />
              <AppText style={styles.errorText}>{error}</AppText>
            </View>
          </GlassCard>
        )}

        {aiOff && (
          // Said once, plainly, above controls that are also disabled. A
          // deliberately switched-off feature is not "temporarily
          // unavailable", and presenting it that way invites people to keep
          // trying something that will never work.
          <GlassCard style={styles.disclaimer}>
            <View style={styles.disclaimerRow}>
              <AlertTriangle size={16} color={colors.onMuted.warning} />
              <AppText style={styles.disclaimerText}>
                {aiAvailability?.reason === 'PLATFORM'
                  ? t('insights.disabledByAdmin')
                  : t('insights.disabledInDeployment')}
              </AppText>
            </View>
          </GlassCard>
        )}

        <SectionHeader>{t('insights.generate')}</SectionHeader>
        {actions.map((action) => (
          <ActionRow
            key={action.key}
            icon={action.icon}
            title={action.title}
            subtitle={action.subtitle}
            disabled={action.disabled || isGenerating}
            onPress={action.onPress}
          />
        ))}

        {isGenerating && <SkeletonCard />}

        {latestInsight && (
          <>
            <SectionHeader>{t('insights.latest')}</SectionHeader>
            <InsightCard insight={latestInsight} expanded>
              {feedbackGiven === latestInsight.id ? (
                <View style={styles.feedbackBlock}>
                  <AppText style={styles.feedbackThanks}>{t('insights.feedbackThanks')}</AppText>
                </View>
              ) : (
                <View style={styles.feedbackBlock}>
                  <AppText style={styles.feedbackPrompt}>{t('insights.helpfulPrompt')}</AppText>
                  <View style={styles.feedbackRow}>
                    <Pressable
                      onPress={() => handleFeedback(latestInsight.id, FeedbackType.HELPFUL)}
                      style={({ pressed }) => [styles.feedbackButton, { opacity: pressed ? 0.6 : 1 }]}
                      accessibilityRole="button"
                    >
                      <ThumbsUp size={16} color={colors.onMuted.success} />
                      <AppText style={[styles.feedbackLabel, { color: colors.onMuted.success }]}>
                        {t('insights.helpful')}
                      </AppText>
                    </Pressable>
                    <Pressable
                      onPress={() => handleFeedback(latestInsight.id, FeedbackType.NOT_HELPFUL)}
                      style={({ pressed }) => [styles.feedbackButton, { opacity: pressed ? 0.6 : 1 }]}
                      accessibilityRole="button"
                    >
                      <ThumbsDown size={16} color={colors.textMuted} />
                      <AppText style={[styles.feedbackLabel, { color: colors.textMuted }]}>
                        {t('insights.notHelpful')}
                      </AppText>
                    </Pressable>
                  </View>
                </View>
              )}
            </InsightCard>
          </>
        )}

        <SectionHeader>{t('insights.yours')}</SectionHeader>
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : history.length === 0 ? (
          <GlassCard>
            <AppText style={styles.emptyTitle}>{t('insights.empty')}</AppText>
            <AppText style={styles.emptyBody}>
              {availableParams.length === 0
                ? t('insights.emptyNoData')
                : t('insights.emptyHasData')}
            </AppText>
          </GlassCard>
        ) : (
          history
            .filter((insight) => insight.id !== latestInsight?.id)
            .map((insight) => (
              <Pressable
                key={insight.id}
                onPress={() => setLatestInsight(insight)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                accessibilityRole="button"
              >
                <InsightCard insight={insight} />
              </Pressable>
            ))
        )}

        <SectionHeader>{t('insights.askAbout')}</SectionHeader>
        <GlassCard>
          <AppTextInput
            placeholder={t('insights.askPlaceholder')}
            value={chatMessage}
            onChangeText={setChatMessage}
            editable={!aiOff}
            multiline
          />
          <AppButton
            onPress={handleChat}
            disabled={aiOff || isGenerating || !chatMessage.trim()}
            style={styles.sendButton}
          >
            {isGenerating ? t('common.sending') : t('insights.send')}
          </AppButton>

          {chatResponse && (
            <View style={styles.chatResponse}>
              <AppText style={styles.chatLabel}>{t('insights.response')}</AppText>
              <AppText style={styles.chatText}>{chatResponse.message.content}</AppText>
            </View>
          )}
        </GlassCard>
      </ScrollView>
    </Screen>
  );
}

function ActionRow({
  icon: Icon,
  title,
  subtitle,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({ opacity: disabled ? 0.45 : pressed ? 0.7 : 1 })}
    >
      <GlassCard style={styles.actionCard}>
        <View style={styles.actionRow}>
          <View style={styles.aiIcon}>
            <Icon size={18} color={colors.onMuted.ai} />
          </View>
          <View style={styles.actionBody}>
            <AppText style={styles.actionTitle}>{title}</AppText>
            <AppText style={styles.actionSubtitle}>{subtitle}</AppText>
          </View>
          <ChevronRight size={16} color={colors.textSubtle} />
        </View>
      </GlassCard>
    </Pressable>
  );
}

function InsightCard({
  insight,
  expanded = false,
  children,
}: {
  insight: AiInsight;
  expanded?: boolean;
  children?: React.ReactNode;
}) {
  const { t, formatDate } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const type = TYPE_ICON[insight.type] ? insight.type : InsightType.GENERAL_HEALTH_INFORMATION;
  const Icon = TYPE_ICON[type];

  return (
    <GlassCard style={styles.insightCard}>
      <View style={styles.insightHead}>
        <View style={styles.aiIcon}>
          <Icon size={18} color={colors.onMuted.ai} />
        </View>
        <View style={styles.insightHeadBody}>
          <AppText style={styles.insightTitle}>{insight.title}</AppText>
          <View style={styles.insightBadges}>
            <Badge variant="ai">{t(`medical.aiInsightTypes.${type}`)}</Badge>
            <Badge variant={safetyVariant(insight.safetyLevel)}>
              {t(`medical.aiSafety.${insight.safetyLevel}`)}
            </Badge>
          </View>
        </View>
      </View>

      <AppText style={styles.insightBody}>{insight.summary}</AppText>

      {expanded && insight.observations.length > 0 && (
        <View style={styles.bulletList}>
          {insight.observations.map((observation) => (
            <View key={observation} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <AppText style={styles.bulletText}>{observation}</AppText>
            </View>
          ))}
        </View>
      )}

      {expanded && insight.dataPoints && insight.dataPoints.length > 0 && (
        <View style={styles.dataBlock}>
          <AppText style={styles.dataLabel}>{t('insights.referencedData')}</AppText>
          {insight.dataPoints.map((point) => (
            <View key={`${point.label}-${point.value}`} style={styles.dataRow}>
              <AppText style={styles.dataRowLabel}>{point.label}</AppText>
              <AppText style={styles.dataRowValue}>
                {point.value}
                {point.unit ? ` ${point.unit}` : ''}
              </AppText>
            </View>
          ))}
        </View>
      )}

      {expanded &&
        insight.questionsForProfessional &&
        insight.questionsForProfessional.length > 0 && (
          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>{t('medical.advice.askYourProvider')}</AppText>
            {insight.questionsForProfessional.map((question) => (
              <View key={question} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <AppText style={styles.bulletText}>{question}</AppText>
              </View>
            ))}
          </View>
        )}

      {expanded && insight.caveats.length > 0 && (
        <View style={styles.section}>
          {insight.caveats.map((caveat) => (
            <AppText key={caveat} style={styles.caveat}>
              {caveat}
            </AppText>
          ))}
        </View>
      )}

      <AppText style={styles.insightDate}>
        {formatDate(insight.generatedAt, 'medium')}
      </AppText>

      {children}
    </GlassCard>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: {
      padding: 0,
    },
    headerBlock: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
    },
    backLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      alignSelf: 'flex-start',
      paddingRight: spacing.sm,
    },
    backLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.ai,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: spacing.sm,
    },
    headerIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.aiMuted,
      borderWidth: 1,
      borderColor: `${colors.onMuted.ai}4D`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      flex: 1,
    },
    headerTitleLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: -0.48,
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },

    content: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xl,
      gap: layout.cardGap,
    },

    disclaimer: {},
    disclaimerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    disclaimerText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textMuted,
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      color: colors.onMuted.danger,
    },

    aiIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.sm,
      backgroundColor: colors.aiMuted,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },

    actionCard: {
      padding: 14,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    actionBody: {
      flex: 1,
    },
    actionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    actionSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },

    insightCard: {
      borderColor: `${colors.onMuted.ai}33`,
    },
    insightHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: layout.cardGap,
    },
    insightHeadBody: {
      flex: 1,
    },
    insightTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 6,
    },
    insightBadges: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    insightBody: {
      fontSize: 13,
      lineHeight: 21,
      color: colors.text,
    },
    insightDate: {
      fontSize: 11,
      color: colors.textSubtle,
      marginTop: layout.cardGap,
    },

    bulletList: {
      marginTop: layout.cardGap,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 8,
    },
    bulletDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.onMuted.ai,
      marginTop: 6,
      flexShrink: 0,
    },
    bulletText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 20,
      color: colors.textMuted,
    },

    dataBlock: {
      marginTop: layout.cardGap,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.sm,
      padding: spacing.md,
    },
    dataLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.5,
      color: colors.textMuted,
      marginBottom: spacing.sm,
    },
    dataRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    dataRowLabel: {
      fontSize: 13,
      color: colors.textMuted,
    },
    dataRowValue: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },

    section: {
      marginTop: layout.cardGap,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      marginBottom: spacing.sm,
    },
    caveat: {
      fontSize: 11,
      fontStyle: 'italic',
      lineHeight: 17,
      color: colors.textMuted,
      marginBottom: spacing.xs,
    },

    feedbackBlock: {
      marginTop: layout.cardGap,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
    },
    feedbackPrompt: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: spacing.sm,
    },
    feedbackRow: {
      flexDirection: 'row',
      gap: spacing.lg,
    },
    feedbackButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 36,
    },
    feedbackLabel: {
      fontSize: 13,
      fontWeight: '600',
    },
    feedbackThanks: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.onMuted.success,
    },

    emptyTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    emptyBody: {
      fontSize: 13,
      lineHeight: 20,
      color: colors.textMuted,
      marginTop: 4,
    },

    sendButton: {
      marginTop: spacing.sm,
    },
    chatResponse: {
      marginTop: layout.cardGap,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
    },
    chatLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.5,
      color: colors.textMuted,
      marginBottom: spacing.xs,
    },
    chatText: {
      fontSize: 13,
      lineHeight: 21,
      color: colors.text,
    },
  });
}
