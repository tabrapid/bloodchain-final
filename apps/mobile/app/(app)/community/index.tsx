import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getFeed, getImpactStats, type CommunityPost, type ImpactStats } from '../../../src/api/community';
import { getActiveChallenges, type Challenge } from '../../../src/api/challenges';
import { getCampaigns, type Campaign } from '../../../src/api/campaigns';
import { Trophy, Users, Calendar, BookOpen, TrendingUp, Award } from 'lucide-react-native';

export default function CommunityScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const { data: feed, isLoading: feedLoading, refetch: refetchFeed } = useQuery({
    queryKey: ['community-feed'],
    queryFn: () => getFeed({ page: 1, limit: 20 }),
  });

  const { data: impactStats } = useQuery({
    queryKey: ['impact-stats'],
    queryFn: getImpactStats,
  });

  const { data: activeChallenges } = useQuery({
    queryKey: ['active-challenges'],
    queryFn: getActiveChallenges,
  });

  const { data: campaigns } = useQuery({
    queryKey: ['active-campaigns'],
    queryFn: () => getCampaigns({ page: 1, limit: 5, status: 'ACTIVE' }),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchFeed()]);
    setRefreshing(false);
  };

  if (feedLoading) {
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
      {/* Impact Stats Card */}
      {impactStats && (
        <View className="bg-white mx-4 mt-4 p-6 rounded-2xl shadow-sm">
          <View className="flex-row items-center mb-4">
            <TrendingUp size={24} color="#dc2626" />
            <Text className="text-xl font-bold text-gray-900 ml-2">Your Impact</Text>
          </View>
          <View className="flex-row flex-wrap">
            <ImpactStat icon={<Award size={20} color="#dc2626" />} label="Donations" value={impactStats.donations} />
            <ImpactStat icon={<Users size={20} color="#dc2626" />} label="Campaigns" value={impactStats.campaignParticipations} />
            <ImpactStat icon={<Trophy size={20} color="#dc2626" />} label="Challenges" value={impactStats.challengeCompletions} />
            <ImpactStat icon={<BookOpen size={20} color="#dc2626" />} label="Education" value={impactStats.educationCompletions} />
          </View>
          <View className="mt-4 pt-4 border-t border-gray-100">
            <View className="flex-row justify-between">
              <View>
                <Text className="text-sm text-gray-500">Level</Text>
                <Text className="text-2xl font-bold text-gray-900">{impactStats.level}</Text>
              </View>
              <View>
                <Text className="text-sm text-gray-500">XP</Text>
                <Text className="text-2xl font-bold text-gray-900">{impactStats.xp}</Text>
              </View>
              <View>
                <Text className="text-sm text-gray-500">Reputation</Text>
                <Text className="text-2xl font-bold text-gray-900">{impactStats.reputation}</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Active Challenges */}
      {activeChallenges && activeChallenges.length > 0 && (
        <View className="bg-white mx-4 mt-4 p-6 rounded-2xl shadow-sm">
          <View className="flex-row items-center mb-4">
            <Trophy size={24} color="#dc2626" />
            <Text className="text-xl font-bold text-gray-900 ml-2">Active Challenges</Text>
          </View>
          {activeChallenges.slice(0, 3).map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </View>
      )}

      {/* Active Campaigns */}
      {campaigns && campaigns.items.length > 0 && (
        <View className="bg-white mx-4 mt-4 p-6 rounded-2xl shadow-sm">
          <View className="flex-row items-center mb-4">
            <Calendar size={24} color="#dc2626" />
            <Text className="text-xl font-bold text-gray-900 ml-2">Active Campaigns</Text>
          </View>
          {campaigns.items.slice(0, 3).map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </View>
      )}

      {/* Community Feed */}
      <View className="bg-white mx-4 mt-4 p-6 rounded-2xl shadow-sm">
        <Text className="text-xl font-bold text-gray-900 mb-4">Community Feed</Text>
        {feed?.items.map((post) => (
          <FeedPostCard key={post.id} post={post} />
        ))}
      </View>

      <View className="h-8" />
    </ScrollView>
  );
}

function ImpactStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <View className="w-1/2 mb-4">
      <View className="flex-row items-center">
        {icon}
        <Text className="text-sm text-gray-500 ml-2">{label}</Text>
      </View>
      <Text className="text-2xl font-bold text-gray-900 mt-1">{value}</Text>
    </View>
  );
}

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const progress = (challenge.userProgress || 0) / challenge.goal;
  
  return (
    <TouchableOpacity className="mb-4 p-4 bg-gray-50 rounded-xl">
      <Text className="text-lg font-semibold text-gray-900">{challenge.title}</Text>
      <Text className="text-sm text-gray-600 mt-1" numberOfLines={2}>
        {challenge.description}
      </Text>
      <View className="mt-3">
        <View className="flex-row justify-between mb-1">
          <Text className="text-xs text-gray-500">Progress</Text>
          <Text className="text-xs font-medium text-gray-700">
            {challenge.userProgress || 0} / {challenge.goal}
          </Text>
        </View>
        <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <View
            className="h-full bg-red-600 rounded-full"
            style={{ width: `${Math.min(progress * 100, 100)}%` }}
          />
        </View>
      </View>
      {challenge.xpReward > 0 && (
        <View className="flex-row items-center mt-2">
          <Trophy size={14} color="#dc2626" />
          <Text className="text-xs font-medium text-red-600 ml-1">
            +{challenge.xpReward} XP
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  return (
    <TouchableOpacity className="mb-4 p-4 bg-gray-50 rounded-xl">
      <Text className="text-lg font-semibold text-gray-900">{campaign.title}</Text>
      <Text className="text-sm text-gray-600 mt-1" numberOfLines={2}>
        {campaign.description}
      </Text>
      <View className="flex-row items-center mt-2">
        <Calendar size={14} color="#6b7280" />
        <Text className="text-xs text-gray-500 ml-1">
          {new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}
        </Text>
      </View>
      {campaign.participantCount && (
        <View className="flex-row items-center mt-1">
          <Users size={14} color="#6b7280" />
          <Text className="text-xs text-gray-500 ml-1">
            {campaign.participantCount} participants
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function FeedPostCard({ post }: { post: CommunityPost }) {
  return (
    <View className="mb-4 pb-4 border-b border-gray-100">
      <View className="flex-row items-center mb-2">
        {post.author?.avatarUrl ? (
          <Image source={{ uri: post.author.avatarUrl }} className="w-8 h-8 rounded-full" />
        ) : (
          <View className="w-8 h-8 rounded-full bg-red-100 items-center justify-center">
            <Text className="text-sm font-medium text-red-600">
              {post.author?.firstName?.[0] || 'U'}
            </Text>
          </View>
        )}
        <View className="ml-2 flex-1">
          <Text className="text-sm font-medium text-gray-900">
            {post.author?.displayName || `${post.author?.firstName} ${post.author?.lastName}`}
          </Text>
          <Text className="text-xs text-gray-500">
            {new Date(post.publishedAt).toLocaleDateString()}
          </Text>
        </View>
        <View className="px-2 py-1 bg-red-100 rounded">
          <Text className="text-xs font-medium text-red-600">{post.type}</Text>
        </View>
      </View>
      <Text className="text-base font-semibold text-gray-900">{post.title}</Text>
      <Text className="text-sm text-gray-700 mt-1">{post.body}</Text>
      {post.imageUrl && (
        <Image source={{ uri: post.imageUrl }} className="w-full h-48 rounded-xl mt-2" resizeMode="cover" />
      )}
    </View>
  );
}
