/* global jest */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  const permission = {
    granted: false,
    canAskAgain: false,
    expires: 'never',
    status: 'denied',
  };
  return {
    CameraView: (props) => React.createElement(View, { ...props, testID: 'camera-view' }),
    useCameraPermissions: () => [permission, async () => permission, async () => permission],
  };
});

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  scheduleNotificationAsync: jest.fn(async () => 'notification-id'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
}));
