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
import { spacing, radius, useTheme, type ThemeColors } from '../../../src/theme';
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
} from '../../../src/api/ai-health';
import { getAvailableParameters, type AvailableParameter } from '../../../src/api/health-trends';
import type { BadgeProps } from '../../../src/components/Badge';

/** Each insight kind gets the reference's icon square, keyed to what it is. */
const TYPE_META: Record<InsightType, { icon: LucideIcon; label: string }> = {
  [InsightType.TREND_SUMMARY]: { icon: TrendingUp, label: 'Trend' },
  [InsightType.RESULT_EXPLANATION]: { icon: Lightbulb, label: 'Results' },
  [InsightType.DATA_CHANGE]: { icon: Activity, label: 'Change' },
  [InsightType.REFERENCE_RANGE_CONTEXT]: { icon: Shield, label: 'Reference range' },
  [InsightType.GENERAL_HEALTH_INFORMATION]: { icon: Brain, label: 'General health' },
  [InsightType.QUESTION_SUGGESTION]: { icon: HelpCircle, label: 'Questions' },
  [InsightType.DATA_QUALITY_WARNING]: { icon: AlertTriangle, label: 'Data quality' },
};

/**
 * The reference ends each insight card with a "94% confidence" meter. Nothing
 * in this system produces a confidence number, and inventing one on health
 * content would be the worst possible place to fake a number -- so the card
 * ends with the insight's real `safetyLevel` instead, which is the field that
 * actually tells a donor how far to trust what they just read.
 */
function safetyBadge(level: SafetyLevel): { label: string; variant: BadgeProps['variant'] } {
  switch (level) {
    case SafetyLevel.SAFE_INFORMATIONAL:
      return { label: 'Informational', variant: 'success' };
    case SafetyLevel.NEEDS_CONTEXT:
      return { label: 'Context needed', variant: 'warning' };
    case SafetyLevel.PROFESSIONAL_REVIEW_SUGGESTED:
      return { label: 'Review suggested', variant: 'warning' };
    case SafetyLevel.EMERGENCY_REDIRECT:
      return { label: 'Seek help', variant: 'danger' };
    default:
      return { label: 'Outside scope', variant: 'default' };
  }
}

export default function InsightsScreen() {
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

  const loadData = useCallback(async () => {
    try {
      const [params, historyResult] = await Promise.all([
        getAvailableParameters(),
        getInsightHistory({ limit: 10 }).catch(() => ({ insights: [], total: 0 })),
      ]);
      setAvailableParams(params);
      setHistory(historyResult.insights);
    } catch {
      setError('Insights are temporarily unavailable.');
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
      setError('Insights are temporarily unavailable.');
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const handleFeedback = useCallback(async (insightId: string, type: FeedbackType) => {
    try {
      await submitFeedback({ insightId, type });
      setFeedbackGiven(insightId);
    } catch {
      setError('Could not send your feedback. Please try again.');
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
      setError('Chat is temporarily unavailable.');
    } finally {
      setIsGenerating(false);
    }
  }, [chatMessage]);

  const actions = useMemo(
    () => [
      {
        key: 'results',
        icon: Brain,
        title: 'Analyze my results',
        subtitle: 'Insights based on your latest laboratory data',
        disabled: availableParams.length === 0,
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
        title: 'Summarize trends',
        subtitle: 'Patterns in your health data over time',
        disabled: availableParams.length === 0,
        onPress: () => {
          const code = availableParams[0]?.code;
          if (!code) return;
          return runGeneration(() => analyzeTrend({ parameterCode: code }));
        },
      },
      {
        key: 'questions',
        icon: MessageSquare,
        title: 'Questions to discuss',
        subtitle: 'Suggested questions for your healthcare provider',
        disabled: false,
        onPress: () =>
          runGeneration(() => generateInsight({ type: InsightType.QUESTION_SUGGESTION })),
      },
    ],
    [availableParams, runGeneration],
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
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.backLink, { opacity: pressed ? 0.6 : 1 }]}
        >
          <ArrowLeft size={16} color={colors.ai} strokeWidth={2.5} />
          <AppText style={styles.backLabel}>Back</AppText>
        </Pressable>

        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <Brain size={22} color={colors.onMuted.ai} />
          </View>
          <View style={styles.headerText}>
            <View style={styles.headerTitleLine}>
              <AppText style={styles.headerTitle}>AI Insights</AppText>
              <Badge variant="ai">Powered by AI</Badge>
            </View>
            <AppText style={styles.headerSubtitle}>
              Personalized health recommendations
            </AppText>
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
            <AppText style={styles.disclaimerText}>
              AI-generated informational content, drawn from your own recorded health data. It is
              not a medical diagnosis — always consult your doctor.
            </AppText>
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

        <SectionHeader>Generate an insight</SectionHeader>
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
            <SectionHeader>Latest insight</SectionHeader>
            <InsightCard insight={latestInsight} expanded>
              {feedbackGiven === latestInsight.id ? (
                <View style={styles.feedbackBlock}>
                  <AppText style={styles.feedbackThanks}>Thank you for your feedback</AppText>
                </View>
              ) : (
                <View style={styles.feedbackBlock}>
                  <AppText style={styles.feedbackPrompt}>Was this insight helpful?</AppText>
                  <View style={styles.feedbackRow}>
                    <Pressable
                      onPress={() => handleFeedback(latestInsight.id, FeedbackType.HELPFUL)}
                      style={({ pressed }) => [styles.feedbackButton, { opacity: pressed ? 0.6 : 1 }]}
                      accessibilityRole="button"
                    >
                      <ThumbsUp size={16} color={colors.onMuted.success} />
                      <AppText style={[styles.feedbackLabel, { color: colors.onMuted.success }]}>
                        Helpful
                      </AppText>
                    </Pressable>
                    <Pressable
                      onPress={() => handleFeedback(latestInsight.id, FeedbackType.NOT_HELPFUL)}
                      style={({ pressed }) => [styles.feedbackButton, { opacity: pressed ? 0.6 : 1 }]}
                      accessibilityRole="button"
                    >
                      <ThumbsDown size={16} color={colors.textMuted} />
                      <AppText style={[styles.feedbackLabel, { color: colors.textMuted }]}>
                        Not helpful
                      </AppText>
                    </Pressable>
                  </View>
                </View>
              )}
            </InsightCard>
          </>
        )}

        <SectionHeader>Your insights</SectionHeader>
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : history.length === 0 ? (
          <GlassCard>
            <AppText style={styles.emptyTitle}>No insights yet</AppText>
            <AppText style={styles.emptyBody}>
              {availableParams.length === 0
                ? 'Complete a blood test and your insights will be generated from it.'
                : 'Generate your first insight above and it will be kept here.'}
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

        <SectionHeader>Ask about my results</SectionHeader>
        <GlassCard>
          <AppTextInput
            placeholder="Ask a question about your health data…"
            value={chatMessage}
            onChangeText={setChatMessage}
            multiline
          />
          <AppButton
            onPress={handleChat}
            disabled={isGenerating || !chatMessage.trim()}
            style={styles.sendButton}
          >
            {isGenerating ? 'Sending…' : 'Send'}
          </AppButton>

          {chatResponse && (
            <View style={styles.chatResponse}>
              <AppText style={styles.chatLabel}>RESPONSE</AppText>
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const meta = TYPE_META[insight.type] ?? TYPE_META[InsightType.GENERAL_HEALTH_INFORMATION];
  const Icon = meta.icon;
  const safety = safetyBadge(insight.safetyLevel);

  return (
    <GlassCard style={styles.insightCard}>
      <View style={styles.insightHead}>
        <View style={styles.aiIcon}>
          <Icon size={18} color={colors.onMuted.ai} />
        </View>
        <View style={styles.insightHeadBody}>
          <AppText style={styles.insightTitle}>{insight.title}</AppText>
          <View style={styles.insightBadges}>
            <Badge variant="ai">{meta.label}</Badge>
            <Badge variant={safety.variant}>{safety.label}</Badge>
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
          <AppText style={styles.dataLabel}>REFERENCED DATA</AppText>
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
            <AppText style={styles.sectionTitle}>Questions for your healthcare provider</AppText>
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
        {new Date(insight.generatedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
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
      gap: 12,
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
      marginBottom: 12,
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
      marginTop: 12,
    },

    bulletList: {
      marginTop: 12,
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
      marginTop: 12,
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
      marginTop: 12,
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
      marginTop: 12,
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
      marginTop: 12,
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
