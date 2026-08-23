import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getEducationalContent,
  startContent,
  completeContent,
  getMyEducationStats,
  type EducationalContent,
} from '../../../src/api/education';
import { BookOpen, Clock, Award, CheckCircle } from 'lucide-react-native';

export default function EducationScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { data: content, isLoading, refetch } = useQuery({
    queryKey: ['educational-content'],
    queryFn: () => getEducationalContent({ page: 1, limit: 50 }),
  });

  const { data: stats } = useQuery({
    queryKey: ['education-stats'],
    queryFn: getMyEducationStats,
  });

  const startMutation = useMutation({
    mutationFn: startContent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['education-progress'] });
      queryClient.invalidateQueries({ queryKey: ['education-stats'] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: completeContent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['educational-content'] });
      queryClient.invalidateQueries({ queryKey: ['education-progress'] });
      queryClient.invalidateQueries({ queryKey: ['education-stats'] });
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View className="p-4">
        <Text className="text-2xl font-bold text-gray-900 mb-2">Education Hub</Text>
        <Text className="text-sm text-gray-600 mb-6">
          Learn about blood donation and earn XP
        </Text>

        {stats && (
          <View className="bg-white p-6 rounded-2xl shadow-sm mb-6">
            <Text className="text-lg font-bold text-gray-900 mb-4">Your Progress</Text>
            <View className="flex-row justify-between">
              <View className="items-center">
                <Text className="text-3xl font-bold text-red-600">{stats.totalCompleted}</Text>
                <Text className="text-sm text-gray-600 mt-1">Completed</Text>
              </View>
              <View className="items-center">
                <Text className="text-3xl font-bold text-red-600">{stats.totalStarted}</Text>
                <Text className="text-sm text-gray-600 mt-1">Started</Text>
              </View>
              <View className="items-center">
                <Text className="text-3xl font-bold text-red-600">{stats.totalXpEarned}</Text>
                <Text className="text-sm text-gray-600 mt-1">XP Earned</Text>
              </View>
            </View>
          </View>
        )}

        <Text className="text-lg font-bold text-gray-900 mb-4">Available Content</Text>

        {content?.items.length === 0 ? (
          <View className="bg-white p-8 rounded-2xl items-center">
            <BookOpen size={48} color="#9ca3af" />
            <Text className="text-lg font-medium text-gray-900 mt-4">No Content Available</Text>
            <Text className="text-sm text-gray-500 mt-2 text-center">
              Check back later for educational content
            </Text>
          </View>
        ) : (
          content?.items.map((item) => (
            <EducationCard
              key={item.id}
              content={item}
              onStart={() => startMutation.mutate(item.id)}
              onComplete={() => completeMutation.mutate(item.id)}
              isStarting={startMutation.isPending}
              isCompleting={completeMutation.isPending}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

function EducationCard({
  content,
  onStart,
  onComplete,
  isStarting,
  isCompleting,
}: {
  content: EducationalContent;
  onStart: () => void;
  onComplete: () => void;
  isStarting: boolean;
  isCompleting: boolean;
}) {
  return (
    <View className="bg-white p-6 rounded-2xl shadow-sm mb-4">
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <View className="flex-row items-center mb-1">
            <View className="px-2 py-1 bg-red-100 rounded mr-2">
              <Text className="text-xs font-medium text-red-600">{content.type}</Text>
            </View>
            <View className="px-2 py-1 bg-gray-100 rounded">
              <Text className="text-xs font-medium text-gray-600">{content.difficulty}</Text>
            </View>
          </View>
          <Text className="text-xl font-bold text-gray-900">{content.title}</Text>
        </View>
      </View>

      <Text className="text-sm text-gray-700 mb-4" numberOfLines={3}>
        {content.description}
      </Text>

      <View className="flex-row items-center mb-4">
        {content.estimatedMinutes && (
          <View className="flex-row items-center mr-4">
            <Clock size={16} color="#6b7280" />
            <Text className="text-sm text-gray-600 ml-1">{content.estimatedMinutes} min</Text>
          </View>
        )}

        {content.xpReward > 0 && (
          <View className="flex-row items-center">
            <Award size={16} color="#dc2626" />
            <Text className="text-sm font-medium text-red-600 ml-1">+{content.xpReward} XP</Text>
          </View>
        )}
      </View>

      <View className="flex-row items-center justify-between">
        <View className="px-3 py-1 bg-gray-100 rounded-full">
          <Text className="text-xs font-medium text-gray-600">{content.category}</Text>
        </View>

        <TouchableOpacity
          onPress={onComplete}
          disabled={isCompleting}
          className="bg-red-600 py-2 px-6 rounded-xl"
        >
          {isCompleting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View className="flex-row items-center">
              <CheckCircle size={16} color="#fff" />
              <Text className="text-white font-semibold ml-1">Complete</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
