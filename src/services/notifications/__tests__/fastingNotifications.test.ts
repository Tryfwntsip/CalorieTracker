import * as Notifications from 'expo-notifications';

import {
  cancelFastingNotifications,
  scheduleFastingNotifications,
} from '@/services/notifications/fastingNotifications';

const copy = {
  startedTitle: 'Started',
  startedBody: 'Timer running',
  endedTitle: 'Complete',
  endedBody: 'Window ended',
};

describe('fasting local notifications', () => {
  beforeEach(() => jest.clearAllMocks());

  it('schedules one start and one end notification after permission is granted', async () => {
    jest
      .mocked(Notifications.scheduleNotificationAsync)
      .mockResolvedValueOnce('start-id')
      .mockResolvedValueOnce('end-id');

    await expect(scheduleFastingNotifications('2026-07-17T00:00:00.000Z', copy)).resolves.toEqual({
      startNotificationId: 'start-id',
      endNotificationId: 'end-id',
    });
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it('does not schedule when permission is denied and cancels persisted IDs', async () => {
    jest
      .mocked(Notifications.requestPermissionsAsync)
      .mockResolvedValueOnce({ status: 'denied' } as Awaited<
        ReturnType<typeof Notifications.requestPermissionsAsync>
      >);
    await expect(scheduleFastingNotifications('2026-07-17T00:00:00.000Z', copy)).resolves.toEqual({
      startNotificationId: null,
      endNotificationId: null,
    });
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

    await cancelFastingNotifications({
      startNotificationId: 'start-id',
      endNotificationId: 'end-id',
    });
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
  });
});
