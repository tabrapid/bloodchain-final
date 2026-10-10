import { useState } from 'react';
import { router } from 'expo-router';
import { UserX } from 'lucide-react-native';
import {
  Banner,
  Button,
  ConfirmationSheet,
  ScreenHeader,
  ScrollScreen,
  Stack,
  Surface,
  Text,
} from '../../src/design';
import { useDeleteAccount } from '../../src/hooks/useUsers';
import { useTranslation } from '../../src/i18n';

/**
 * What deleting the account does, said once, in full, before it is offered.
 *
 * A full screen rather than a sheet: a sheet invites dismissal, and this is
 * the one place the consequences are written out. Three blocks -- what goes,
 * what stays, what it does not do -- and then one destructive action with a
 * second confirmation behind it. The primary button is the destructive one
 * and it is not the first thing in the reading order; "keep my account" is
 * the same size and sits beside it.
 *
 * Nothing here is invented: every item under "what goes" is something the
 * endpoint removes, and "what stays" names the records it leaves alone
 * without claiming how long the blood service keeps them.
 */
export default function DeleteAccount() {
  const { t } = useTranslation();
  const deletion = useDeleteAccount();
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);

  const confirm = () => {
    setConfirming(false);
    setFailed(false);
    deletion.mutate(undefined, { onError: () => setFailed(true) });
  };

  return (
    <ScrollScreen
      header={
        <ScreenHeader
          title={t('privacy.deleteTitle')}
          size="large"
          onBack={() => router.back()}
          backLabel={t('common.a11yGoBack')}
        />
      }
    >
      <Stack gap="xl">
        <Text variant="body" tone="secondary">
          {t('privacy.deleteIntro')}
        </Text>

        {failed ? <Banner tone="critical" title={t('privacy.deleteFailed')} /> : null}

        <Surface level="flat">
          <Stack gap="lg">
            <Block title={t('privacy.deleteGoesTitle')} body={t('privacy.deleteGoesBody')} />
            <Block title={t('privacy.deleteStaysTitle')} body={t('privacy.deleteStaysBody')} />
            <Block title={t('privacy.deleteNotTitle')} body={t('privacy.deleteNotBody')} />
          </Stack>
        </Surface>

        <Stack gap="sm">
          <Button
            label={t('privacy.deleteKeep')}
            variant="secondary"
            onPress={() => router.back()}
            disabled={deletion.isPending}
          />
          <Button
            label={t('privacy.deleteConfirm')}
            variant="critical"
            icon={({ size, color }) => <UserX size={size} color={color} />}
            onPress={() => setConfirming(true)}
            loading={deletion.isPending}
          />
        </Stack>
      </Stack>

      <ConfirmationSheet
        visible={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={confirm}
        title={t('privacy.deleteConfirmTitle')}
        description={t('privacy.deleteConfirmBody')}
        confirmLabel={t('privacy.deleteConfirm')}
        cancelLabel={t('privacy.deleteKeep')}
        destructive
        busy={deletion.isPending}
      />
    </ScrollScreen>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <Stack gap="xs">
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="body" tone="secondary">
        {body}
      </Text>
    </Stack>
  );
}
