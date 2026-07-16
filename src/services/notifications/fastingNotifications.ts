import * as Notifications from 'expo-notifications';

export type FastingNotificationCopy = {
  startedTitle: string;
  startedBody: string;
  endedTitle: string;
  endedBody: string;
};

export type FastingNotificationIds = {
  startNotificationId: string | null;
  endNotificationId: string | null;
};

export async function scheduleFastingNotifications(
  targetEndAt: string,
  copy: FastingNotificationCopy,
): Promise<FastingNotificationIds> {
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') {
    return { startNotificationId: null, endNotificationId: null };
  }
  const startNotificationId = await Notifications.scheduleNotificationAsync({
    content: { title: copy.startedTitle, body: copy.startedBody },
    trigger: null,
  });
  const endNotificationId = await Notifications.scheduleNotificationAsync({
    content: { title: copy.endedTitle, body: copy.endedBody },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(targetEndAt) },
  });
  return { startNotificationId, endNotificationId };
}

export async function cancelFastingNotifications(ids: FastingNotificationIds): Promise<void> {
  const present = [ids.startNotificationId, ids.endNotificationId].filter(
    (id): id is string => id !== null,
  );
  if (present.length === 0) return;
  await Promise.all(present.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}
