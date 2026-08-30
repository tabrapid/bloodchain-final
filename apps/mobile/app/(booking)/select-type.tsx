import { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Droplet, HeartPulse, Stethoscope } from 'lucide-react-native';
import { AppButton, AppText, Card, GlassCard, Screen } from '../../src/components';
import { spacing, radius, useTheme, ThemeColors } from '../../src/theme';

export default function Booking() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const APPOINTMENT_TYPES = useMemo(
    () => [
      {
        id: 'BLOOD_DONATION',
        title: 'Blood Donation',
        description: 'Donate blood to help those in need',
        icon: Droplet,
        color: colors.primary,
        bg: colors.primaryMuted,
        iconColor: colors.onMuted.primary,
      },
      {
        id: 'BLOOD_TEST',
        title: 'Blood Test',
        description: 'Get your blood tested for various parameters',
        icon: HeartPulse,
        color: colors.success,
        bg: colors.successMuted,
        iconColor: colors.onMuted.success,
      },
      {
        id: 'CONSULTATION',
        title: 'Consultation',
        description: 'Speak with a healthcare professional',
        icon: Stethoscope,
        color: colors.secondary,
        bg: colors.secondaryMuted,
        iconColor: colors.onMuted.secondary,
      },
    ],
    [colors],
  );
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const handleNext = () => {
    if (selectedType) {
      router.push({
        pathname: '/(booking)/organizations',
        params: { type: selectedType },
      });
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title" style={styles.title}>
          Book an Appointment
        </AppText>
        <AppText muted style={styles.subtitle}>
          Select the type of appointment you would like to book.
        </AppText>

        <View style={styles.typesList}>
          {APPOINTMENT_TYPES.map((type) => {
            const Icon = type.icon;
            const isSelected = selectedType === type.id;

            return (
              <TouchableOpacity
                key={type.id}
                onPress={() => setSelectedType(type.id)}
                activeOpacity={0.8}
              >
                <GlassCard
                  style={[
                    styles.typeCard,
                    isSelected && { borderColor: type.color, borderWidth: 2 },
                  ]}
                >
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: type.bg },
                    ]}
                  >
                    <Icon size={28} color={type.iconColor} />
                  </View>
                  <View style={styles.typeInfo}>
                    <AppText variant="heading">{type.title}</AppText>
                    <AppText muted style={styles.typeDescription}>
                      {type.description}
                    </AppText>
                  </View>
                  <View
                    style={[
                      styles.radioOuter,
                      isSelected && { borderColor: type.color },
                    ]}
                  >
                    {isSelected && (
                      <View
                        style={[styles.radioInner, { backgroundColor: type.color }]}
                      />
                    )}
                  </View>
                </GlassCard>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <AppButton
          onPress={handleNext}
          disabled={!selectedType}
        >
          Continue
        </AppButton>
      </View>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      paddingBottom: spacing.xl,
    },
    title: {
      marginBottom: spacing.xs,
    },
    subtitle: {
      marginBottom: spacing.xl,
    },
    typesList: {
      gap: spacing.md,
    },
    typeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
    },
    iconContainer: {
      width: 56,
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    typeInfo: {
      flex: 1,
    },
    typeDescription: {
      fontSize: 13,
      marginTop: 2,
    },
    radioOuter: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    footer: {
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
    },
  });
}