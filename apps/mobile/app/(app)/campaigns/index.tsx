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
import { getCampaigns, joinCampaign, type Campaign } from '../../../src/api/campaigns';
import { Calendar, Users, MapPin, Droplet } from 'lucide-react-native';

export default function CampaignsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => getCampaigns({ page: 1, limit: 50, status: 'ACTIVE' }),
  });

  const joinMutation = useMutation({
    mutationFn: joinCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['my-campaigns'] });
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
        <Text className="text-2xl font-bold text-gray-900 mb-2">Blood Donation Campaigns</Text>
        <Text className="text-sm text-gray-600 mb-6">
          Join campaigns to help save lives in your community
        </Text>

        {data?.items.length === 0 ? (
          <View className="bg-white p-8 rounded-2xl items-center">
            <Calendar size={48} color="#9ca3af" />
            <Text className="text-lg font-medium text-gray-900 mt-4">No Active Campaigns</Text>
            <Text className="text-sm text-gray-500 mt-2 text-center">
              Check back later for new blood donation campaigns
            </Text>
          </View>
        ) : (
          data?.items.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onJoin={() => joinMutation.mutate(campaign.id)}
              isJoining={joinMutation.isPending}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

function CampaignCard({
  campaign,
  onJoin,
  isJoining,
}: {
  campaign: Campaign;
  onJoin: () => void;
  isJoining: boolean;
}) {
  const startDate = new Date(campaign.startDate);
  const endDate = new Date(campaign.endDate);
  const now = new Date();
  const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <View className="bg-white p-6 rounded-2xl shadow-sm mb-4">
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <Text className="text-xl font-bold text-gray-900">{campaign.title}</Text>
          {campaign.organization && (
            <Text className="text-sm text-gray-600 mt-1">{campaign.organization.name}</Text>
          )}
        </View>
        {daysLeft > 0 && daysLeft <= 7 && (
          <View className="px-3 py-1 bg-red-100 rounded-full">
            <Text className="text-xs font-medium text-red-600">{daysLeft} days left</Text>
          </View>
        )}
      </View>

      <Text className="text-sm text-gray-700 mb-4" numberOfLines={3}>
        {campaign.description}
      </Text>

      <View className="space-y-2 mb-4">
        <View className="flex-row items-center">
          <Calendar size={16} color="#6b7280" />
          <Text className="text-sm text-gray-600 ml-2">
            {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
          </Text>
        </View>

        {campaign.location && (
          <View className="flex-row items-center">
            <MapPin size={16} color="#6b7280" />
            <Text className="text-sm text-gray-600 ml-2">{campaign.location}</Text>
          </View>
        )}

        {campaign.bloodGroupsNeeded && campaign.bloodGroupsNeeded.length > 0 && (
          <View className="flex-row items-center">
            <Droplet size={16} color="#6b7280" />
            <Text className="text-sm text-gray-600 ml-2">
              Blood types needed: {campaign.bloodGroupsNeeded.join(', ')}
            </Text>
          </View>
        )}

        {campaign.participantCount !== undefined && (
          <View className="flex-row items-center">
            <Users size={16} color="#6b7280" />
            <Text className="text-sm text-gray-600 ml-2">
              {campaign.participantCount} participants
              {campaign.targetParticipants && ` / ${campaign.targetParticipants} target`}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        onPress={onJoin}
        disabled={isJoining}
        className="bg-red-600 py-3 px-6 rounded-xl items-center"
      >
        {isJoining ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold">Join Campaign</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
