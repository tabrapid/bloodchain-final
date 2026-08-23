import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { Stack } from 'expo-router';
import {
  Brain,
  ChevronRight,
  Lightbulb,
  MessageSquare,
  RefreshCw,
  Shield,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react-native';
import { AppText, Card, GlassCard, LoadingState, Screen, SectionHeader } from '../../../src/components';
import { colors, spacing } from '../../../src/theme';
import {
  generateInsight,
  analyzeTrend,
  sendChatMessage,
  InsightType,
  SafetyLevel,
  AiInsight,
  ChatResponse,
} from '../../../src/api/ai-health';
import { getAvailableParameters, getTrendSummary, AvailableParameter } from '../../../src/api/health-trends';

const TIME_RANGES = ['1M', '3M', '6M', '1Y', '2Y', 'ALL'] as const;

export default function InsightsScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [latestInsight, setLatestInsight] = useState<AiInsight | null>(null);
  const [availableParams, setAvailableParams] = useState<AvailableParameter[]>([]);
  const [selectedParam, setSelectedParam] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatResponse, setChatResponse] = useState<ChatResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const params = await getAvailableParameters();
      setAvailableParams(params);
      if (params.length > 0 && params[0]) {
        setSelectedParam(params[0].code);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
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
    loadData();
  }, [loadData]);

  const handleGenerateTrendInsight = useCallback(async () => {
    if (!selectedParam) return;
    setIsGenerating(true);
    setError(null);
    try {
      const insight = await analyzeTrend({ parameterCode: selectedParam });
      setLatestInsight(insight);
    } catch (err) {
      console.error('Failed to generate insight:', err);
      setError('Insights are temporarily unavailable.');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedParam]);

  const handleExplainLatest = useCallback(async () => {
    if (availableParams.length === 0) return;
    setIsGenerating(true);
    setError(null);
    try {
      const insight = await generateInsight({
        type: InsightType.RESULT_EXPLANATION,
        parameterCode: availableParams[0]?.code,
      });
      setLatestInsight(insight);
    } catch (err) {
      console.error('Failed to generate insight:', err);
      setError('Insights are temporarily unavailable.');
    } finally {
      setIsGenerating(false);
    }
  }, [availableParams]);

  const handleGenerateQuestions = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const insight = await generateInsight({ type: InsightType.QUESTION_SUGGESTION });
      setLatestInsight(insight);
    } catch (err) {
      console.error('Failed to generate insight:', err);
      setError('Insights are temporarily unavailable.');
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const handleChat = useCallback(async () => {
    if (!chatMessage.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const response = await sendChatMessage({ message: chatMessage });
      setChatResponse(response);
      if (response.message.insight) {
        setLatestInsight(response.message.insight);
      }
      setChatMessage('');
    } catch (err) {
      console.error('Failed to send chat:', err);
      setError('Chat is temporarily unavailable.');
    } finally {
      setIsGenerating(false);
    }
  }, [chatMessage]);

  const getSafetyBadge = (level: SafetyLevel) => {
    switch (level) {
      case SafetyLevel.SAFE_INFORMATIONAL:
        return { color: colors.success, label: 'Informational' };
      case SafetyLevel.NEEDS_CONTEXT:
        return { color: colors.warning, label: 'Context needed' };
      case SafetyLevel.PROFESSIONAL_REVIEW_SUGGESTED:
        return { color: colors.warning, label: 'Professional review suggested' };
      case SafetyLevel.EMERGENCY_REDIRECT:
        return { color: colors.danger, label: 'Seek help' };
      case SafetyLevel.OUT_OF_SCOPE:
        return { color: colors.textMuted, label: 'Outside scope' };
      default:
        return { color: colors.textMuted, label: 'Unknown' };
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'AI Health Insights' }} />
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'AI Health Insights' }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
          <Brain size={20} color={colors.ai} />
          <AppText muted style={{ fontSize: 13 }}>
            Personalized information based on your recorded health data
          </AppText>
        </View>

        <GlassCard style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Shield size={16} color={colors.secondary} />
            <AppText muted style={{ fontSize: 12, flex: 1 }}>
              AI-generated informational content. Not a medical diagnosis.
            </AppText>
          </View>
        </GlassCard>

        {availableParams.length === 0 ? (
          <Card>
            <View style={{ alignItems: 'center', padding: spacing.xl }}>
              <Lightbulb size={48} color={colors.textMuted} />
              <AppText variant="heading" style={{ marginTop: spacing.md, textAlign: 'center' }}>
                No data available
              </AppText>
              <AppText muted style={{ marginTop: spacing.sm, textAlign: 'center' }}>
                Complete a blood test to receive AI-powered health insights.
              </AppText>
            </View>
          </Card>
        ) : (
          <>
            <SectionHeader>INSIGHTS</SectionHeader>

            <TouchableOpacity onPress={handleExplainLatest} disabled={isGenerating}>
              <Card style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: colors.ai + '20',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Brain size={24} color={colors.ai} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="heading">Analyze My Results</AppText>
                    <AppText muted style={{ fontSize: 13 }}>
                      Get insights based on your latest laboratory data
                    </AppText>
                  </View>
                  {isGenerating ? (
                    <RefreshCw size={20} color={colors.textMuted} />
                  ) : (
                    <ChevronRight size={20} color={colors.textMuted} />
                  )}
                </View>
              </Card>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleGenerateTrendInsight} disabled={isGenerating || !selectedParam}>
              <Card style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: colors.success + '20',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <TrendingUp size={24} color={colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="heading">Summarize Trends</AppText>
                    <AppText muted style={{ fontSize: 13 }}>
                      Review patterns in your health data over time
                    </AppText>
                  </View>
                  {isGenerating ? (
                    <RefreshCw size={20} color={colors.textMuted} />
                  ) : (
                    <ChevronRight size={20} color={colors.textMuted} />
                  )}
                </View>
              </Card>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleGenerateQuestions} disabled={isGenerating}>
              <Card style={{ marginBottom: spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: colors.secondary + '20',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MessageSquare size={24} color={colors.secondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="heading">Questions to Discuss</AppText>
                    <AppText muted style={{ fontSize: 13 }}>
                      Get suggested questions for your healthcare provider
                    </AppText>
                  </View>
                  {isGenerating ? (
                    <RefreshCw size={20} color={colors.textMuted} />
                  ) : (
                    <ChevronRight size={20} color={colors.textMuted} />
                  )}
                </View>
              </Card>
            </TouchableOpacity>

            {error && (
              <GlassCard style={{ marginBottom: spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <AlertTriangle size={16} color={colors.warning} />
                  <AppText muted style={{ flex: 1 }}>{error}</AppText>
                </View>
              </GlassCard>
            )}

            {latestInsight && (
              <>
                <SectionHeader>LATEST INSIGHT</SectionHeader>
                <Card style={{ marginBottom: spacing.lg }}>
                  <View style={{ marginBottom: spacing.md }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <AppText variant="heading">{latestInsight.title}</AppText>
                      <View
                        style={{
                          paddingHorizontal: spacing.sm,
                          paddingVertical: 2,
                          borderRadius: 4,
                          backgroundColor: getSafetyBadge(latestInsight.safetyLevel).color + '20',
                        }}
                      >
                        <AppText style={{ fontSize: 10, color: getSafetyBadge(latestInsight.safetyLevel).color }}>
                          {getSafetyBadge(latestInsight.safetyLevel).label}
                        </AppText>
                      </View>
                    </View>
                    <AppText muted style={{ fontSize: 12, marginTop: spacing.xs }}>
                      {formatDate(latestInsight.generatedAt)}
                    </AppText>
                  </View>

                  <AppText style={{ marginBottom: spacing.md }}>{latestInsight.summary}</AppText>

                  {latestInsight.observations.length > 0 && (
                    <View style={{ marginBottom: spacing.md }}>
                      {latestInsight.observations.map((obs, idx) => (
                        <View key={idx} style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs }}>
                          <AppText muted>•</AppText>
                          <AppText muted style={{ flex: 1 }}>{obs}</AppText>
                        </View>
                      ))}
                    </View>
                  )}

                  {latestInsight.dataPoints && latestInsight.dataPoints.length > 0 && (
                    <View
                      style={{
                        backgroundColor: colors.surface,
                        borderRadius: 8,
                        padding: spacing.md,
                        marginBottom: spacing.md,
                      }}
                    >
                      <AppText muted style={{ fontSize: 12, marginBottom: spacing.sm }}>
                        Referenced Data
                      </AppText>
                      {latestInsight.dataPoints.map((dp, idx) => (
                        <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                          <AppText muted style={{ fontSize: 13 }}>{dp.label}</AppText>
                          <AppText style={{ fontSize: 13 }}>
                            {dp.value} {dp.unit}
                          </AppText>
                        </View>
                      ))}
                    </View>
                  )}

                  {latestInsight.questionsForProfessional && latestInsight.questionsForProfessional.length > 0 && (
                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md }}>
                      <AppText variant="heading" style={{ fontSize: 14, marginBottom: spacing.sm }}>
                        Questions for your healthcare provider
                      </AppText>
                      {latestInsight.questionsForProfessional.map((q, idx) => (
                        <View key={idx} style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs }}>
                          <AppText muted>•</AppText>
                          <AppText muted style={{ flex: 1 }}>{q}</AppText>
                        </View>
                      ))}
                    </View>
                  )}

                  {latestInsight.caveats.length > 0 && (
                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, marginTop: spacing.md }}>
                      {latestInsight.caveats.map((caveat, idx) => (
                        <AppText key={idx} muted style={{ fontSize: 11, fontStyle: 'italic', marginBottom: spacing.xs }}>
                          {caveat}
                        </AppText>
                      ))}
                    </View>
                  )}
                </Card>
              </>
            )}

            <SectionHeader>ASK ABOUT MY RESULTS</SectionHeader>
            <Card style={{ marginBottom: spacing.lg }}>
              <TextInput
                value={chatMessage}
                onChangeText={setChatMessage}
                placeholder="Ask a question about your health data..."
                placeholderTextColor={colors.textMuted}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 8,
                  padding: spacing.md,
                  color: colors.text,
                  fontSize: 14,
                  minHeight: 80,
                  textAlignVertical: 'top',
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                multiline
              />
              <TouchableOpacity
                onPress={handleChat}
                disabled={isGenerating || !chatMessage.trim()}
                style={{
                  marginTop: spacing.md,
                  padding: spacing.md,
                  borderRadius: 8,
                  backgroundColor: chatMessage.trim() && !isGenerating ? colors.primary : colors.surface,
                  alignItems: 'center',
                }}
              >
                <AppText
                  style={{
                    color: chatMessage.trim() && !isGenerating ? colors.text : colors.textMuted,
                    fontWeight: '600',
                  }}
                >
                  {isGenerating ? 'Sending...' : 'Send'}
                </AppText>
              </TouchableOpacity>
            </Card>
          </>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </Screen>
  );
}
