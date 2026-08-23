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
import { getActiveChallenges, joinChallenge, type Challenge } from '../../../src/api/challenges';
import { Trophy, Target, Clock, Award } from 'lucide-react-native';

export default function ChallengesScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { data: challenges, isLoading, refetch } = useQuery({
    queryKey: ['active-challenges'],
    queryFn: getActiveChallenges,
  });

  const joinMutation = useMutation({
    mutationFn: joinChallenge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-challenges'] });
      queryClient.invalidateQueries({ queryKey: ['my-challenges'] });
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
        <Text className="text-2xl font-bold text-gray-900 mb-2">Challenges</Text>
        <Text className="text-sm text-gray-600 mb-6">
          Complete challenges to earn XP and badges
        </Text>

        {challenges?.length === 0 ? (
          <View className="bg-white p-8 rounded-2xl items-center">
            <Trophy size={48} color="#9ca3af" />
            <Text className="text-lg font-medium text-gray-900 mt-4">No Active Challenges</Text>
            <Text className="text-sm text-gray-500 mt-2 text-center">
              Check back later for new challenges
            </Text>
          </View>
        ) : (
          challenges?.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              onJoin={() => joinMutation.mutate(challenge.id)}
              isJoining={joinMutation.isPending}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

function ChallengeCard({
  challenge,
  onJoin,
  isJoining,
}: {
  challenge: Challenge;
  onJoin: () => void;
  isJoining: boolean;
}) {
  const progress = (challenge.userProgress || 0) / challenge.goal;
  const hasJoined = challenge.userProgress !== undefined;

  return (
    <View className="bg-white p-6 rounded-2xl shadow-sm mb-4">
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <View className="flex-row items-center mb-1">
            <View className="px-2 py-1 bg-red-100 rounded mr-2">
              <Text className="text-xs font-medium text-red-600">{challenge.type}</Text>
            </View>
          </View>
          <Text className="text-xl font-bold text-gray-900">{challenge.title}</Text>
        </View>
      </View>

      <Text className="text-sm text-gray-700 mb-4" numberOfLines={3}>
        {challenge.description}
      </Text>

      {challenge.endDate && (
        <View className="flex-row items-center mb-3">
          <Clock size={16} color="#6b7280" />
          <Text className="text-sm text-gray-600 ml-2">
            Ends {new Date(challenge.endDate).toLocaleDateString()}
          </Text>
        </View>
      )}

      <View className="mb-4">
        <View className="flex-row justify-between mb-2">
          <Text className="text-sm font-medium text-gray-700">Progress</Text>
          <Text className="text-sm font-medium text-gray-700">
            {challenge.userProgress || 0} / {challenge.goal}
          </Text>
        </View>
        <View className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <View
            className="h-full bg-red-600 rounded-full"
            style={{ width: `${Math.min(progress * 100, 100)}%` }}
          />
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        {challenge.xpReward > 0 && (
          <View className="flex-row items-center">
            <Trophy size={18} color="#dc2626" />
            <Text className="text-sm font-bold text-red-600 ml-1">
              +{challenge.xpReward} XP
            </Text>
          </View>
        )}

        {challenge.badge && (
          <View className="flex-row items-center">
            <Award size={18} color="#dc2626" />
            <Text className="text-sm font-medium text-gray-700 ml-1">
              {challenge.badge.name}
            </Text>
          </View>
        )}
      </View>

      {!hasJoined && (
        <TouchableOpacity
          onPress={onJoin}
          disabled={isJoining}
          className="bg-red-600 py-3 px-6 rounded-xl items-center mt-4"
        >
          {isJoining ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold">Join Challenge</Text>
          )}
        </TouchableOpacity>
      )}

      {hasJoined && progress >= 1 && (
        <View className="bg-green-100 py-3 px-6 rounded-xl items-center mt-4">
          <Text className="text-green-600 font-semibold">Challenge Completed!</Text>
        </View>
      )}
    </View>
  );
}
