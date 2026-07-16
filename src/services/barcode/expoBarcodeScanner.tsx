import { CameraView, useCameraPermissions } from 'expo-camera';
import type { StyleProp, ViewStyle } from 'react-native';

export type BarcodeScanEvent = {
  data: string;
  type: string;
};

export type BarcodeScannerPermission = {
  loading: boolean;
  granted: boolean;
  canAskAgain: boolean;
  request: () => Promise<void>;
};

export function useBarcodeScannerPermission(): BarcodeScannerPermission {
  const [permission, requestPermission] = useCameraPermissions();
  return {
    loading: permission === null,
    granted: permission?.granted ?? false,
    canAskAgain: permission?.canAskAgain ?? true,
    request: async () => {
      await requestPermission();
    },
  };
}

export function BarcodeCameraView({
  active,
  style,
  onScanned,
  onError,
}: {
  active: boolean;
  style?: StyleProp<ViewStyle>;
  onScanned: (event: BarcodeScanEvent) => void;
  onError: () => void;
}) {
  return (
    <CameraView
      active={active}
      facing="back"
      style={style}
      barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
      onBarcodeScanned={active ? ({ data, type }) => onScanned({ data, type }) : undefined}
      onMountError={onError}
    />
  );
}
