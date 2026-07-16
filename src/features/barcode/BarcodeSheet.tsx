import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDatabase } from '@/db/DatabaseProvider';
import { normalizeBarcode } from '@/domain/barcode';
import { foodSnapshotForGrams } from '@/domain/food';
import { createId } from '@/lib/id';
import {
  createBarcodeRepository,
  createDiaryRepository,
  createFoodRepository,
} from '@/repositories';
import { barcodeInputSchema, customFoodInputSchema, foodLogInputSchema } from '@/schemas';
import {
  BarcodeCameraView,
  useBarcodeScannerPermission,
  type BarcodeScanEvent,
} from '@/services/barcode/expoBarcodeScanner';
import { lookupBarcode, type BarcodeLookupResult } from '@/services/barcode/lookup';
import type { BarcodeScanHistory, Food } from '@/types';
import { AppText, Button, Card, Input, Sheet } from '@/ui/components';
import { useTheme } from '@/ui/theme';
import { radii, spacing } from '@/ui/tokens';

type Mode = 'scan' | 'manual' | 'loading' | 'result' | 'missing' | 'history' | 'custom';
type HistoryRow = BarcodeScanHistory & { food: Food | null };

type Props = {
  visible: boolean;
  dayDate: string;
  section: string;
  onClose: () => void;
  onLogged: () => Promise<void>;
  lookupService?: typeof lookupBarcode;
};

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function displayName(food: Food, language: string): string {
  return language === 'el' ? (food.nameEl ?? food.name) : food.name;
}

export function BarcodeSheet({
  visible,
  dayDate,
  section,
  onClose,
  onLogged,
  lookupService = lookupBarcode,
}: Props) {
  const database = useDatabase();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const permission = useBarcodeScannerPermission();
  const scanLocked = useRef(false);
  const barcodes = useMemo(() => createBarcodeRepository(database), [database]);
  const foods = useMemo(() => createFoodRepository(database), [database]);
  const diary = useMemo(() => createDiaryRepository(database), [database]);
  const [mode, setMode] = useState<Mode>('scan');
  const [manualBarcode, setManualBarcode] = useState('');
  const [manualType, setManualType] = useState<'manual' | 'upc_e'>('manual');
  const [barcode, setBarcode] = useState('');
  const [lookupResult, setLookupResult] = useState<BarcodeLookupResult | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [grams, setGrams] = useState('100');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || mode !== 'history') return;
    let active = true;
    void barcodes
      .listHistory()
      .then(async (entries) =>
        Promise.all(
          entries.map(async (entry) => ({
            ...entry,
            food: entry.resolvedFoodId ? await foods.get(entry.resolvedFoodId) : null,
          })),
        ),
      )
      .then((rows) => {
        if (active) setHistory(rows);
      })
      .catch(() => {
        if (active) setError(t('barcode.errors.local'));
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [barcodes, foods, mode, t, visible]);

  const resetForScan = () => {
    scanLocked.current = false;
    setBarcode('');
    setLookupResult(null);
    setError(null);
    setMode('scan');
  };

  const openHistory = () => {
    setError(null);
    setHistoryLoading(true);
    setMode('history');
  };

  const runLookup = async (raw: string, type: string = 'manual') => {
    if (scanLocked.current) return;
    const parsed = barcodeInputSchema.safeParse({ barcode: raw });
    const normalized = parsed.success ? normalizeBarcode(parsed.data.barcode, type) : null;
    if (!normalized) {
      scanLocked.current = false;
      setMode('manual');
      setError(t('barcode.invalid'));
      return;
    }

    scanLocked.current = true;
    setBarcode(normalized);
    setMode('loading');
    setError(null);
    try {
      const result = await lookupService(
        database,
        normalized,
        i18n.language === 'el' ? 'el' : 'en',
      );
      setLookupResult(result);
      if (result.food) {
        setGrams(String(result.food.servingGrams ?? 100));
        setMode('result');
      } else {
        setMode('missing');
      }
    } catch {
      scanLocked.current = false;
      setMode('manual');
      setError(t('barcode.errors.local'));
    }
  };

  const logFood = async () => {
    const food = lookupResult?.food;
    const resolvedGrams = optionalNumber(grams);
    const form = foodLogInputSchema.safeParse({
      quantity: resolvedGrams,
      grams: resolvedGrams,
      unit: 'g',
    });
    if (!food || !form.success) return;
    const snapshot = foodSnapshotForGrams(food, form.data.grams);
    await diary.createEntry({
      id: createId(),
      dayDate,
      section,
      foodId: food.id,
      customLabel: null,
      quantity: form.data.quantity,
      unit: form.data.unit,
      gramsResolved: form.data.grams,
      ...snapshot,
      loggedVia: 'barcode',
      deletedAt: null,
    });
    await foods.markRecent(food.id);
    await onLogged();
    onClose();
  };

  const food = lookupResult?.food ?? null;
  const resolvedGrams = optionalNumber(grams) ?? 0;
  const snapshot = food ? foodSnapshotForGrams(food, resolvedGrams) : null;
  const title =
    mode === 'history'
      ? t('barcode.historyTitle')
      : mode === 'custom'
        ? t('barcode.customTitle')
        : mode === 'result'
          ? t('barcode.foundTitle')
          : t('barcode.title');

  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {mode === 'scan' ? (
          <>
            <View style={styles.actions}>
              <Button
                label={t('barcode.manualEntry')}
                variant="secondary"
                onPress={() => {
                  scanLocked.current = false;
                  setMode('manual');
                }}
              />
              <Button label={t('barcode.history')} variant="ghost" onPress={openHistory} />
            </View>
            {permission.loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : permission.granted ? (
              <>
                <View style={styles.cameraFrame}>
                  <BarcodeCameraView
                    active={visible && mode === 'scan'}
                    style={styles.camera}
                    onScanned={(event: BarcodeScanEvent) => void runLookup(event.data, event.type)}
                    onError={() => setError(t('barcode.cameraError'))}
                  />
                  <View
                    pointerEvents="none"
                    style={[styles.scanWindow, { borderColor: colors.onPrimary }]}
                  />
                </View>
                <AppText color="secondary">{t('barcode.cameraHint')}</AppText>
              </>
            ) : (
              <Card>
                <AppText variant="headline">{t('barcode.cameraPermissionTitle')}</AppText>
                <AppText color="secondary">
                  {permission.canAskAgain
                    ? t('barcode.cameraPermissionBody')
                    : t('barcode.cameraPermissionDenied')}
                </AppText>
                {permission.canAskAgain ? (
                  <Button
                    label={t('barcode.allowCamera')}
                    onPress={() => {
                      void permission.request().catch(() => setError(t('barcode.errors.local')));
                    }}
                  />
                ) : null}
              </Card>
            )}
            {error ? <AppText color="danger">{error}</AppText> : null}
          </>
        ) : null}

        {mode === 'manual' ? (
          <>
            <Input
              label={t('barcode.barcodeLabel')}
              value={manualBarcode}
              onChangeText={setManualBarcode}
              keyboardType="number-pad"
              returnKeyType="search"
              error={error ?? undefined}
              onSubmitEditing={() => void runLookup(manualBarcode, manualType)}
            />
            <View style={styles.actions}>
              <Button
                label={t('barcode.formatAutomatic')}
                variant={manualType === 'manual' ? 'primary' : 'secondary'}
                onPress={() => setManualType('manual')}
              />
              <Button
                label={t('barcode.formatUpcE')}
                variant={manualType === 'upc_e' ? 'primary' : 'secondary'}
                onPress={() => setManualType('upc_e')}
              />
            </View>
            <View style={styles.actions}>
              <Button
                label={t('barcode.lookup')}
                disabled={!manualBarcode.trim()}
                onPress={() => void runLookup(manualBarcode, manualType)}
              />
              <Button label={t('barcode.scan')} variant="secondary" onPress={resetForScan} />
              <Button label={t('barcode.history')} variant="ghost" onPress={openHistory} />
            </View>
          </>
        ) : null}

        {mode === 'loading' ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <AppText color="secondary">{t('barcode.lookingUp')}</AppText>
          </View>
        ) : null}

        {mode === 'result' && lookupResult && food && snapshot ? (
          <>
            <Card>
              <AppText variant="headline">{displayName(food, i18n.language)}</AppText>
              {food.brand ? <AppText color="secondary">{food.brand}</AppText> : null}
              <AppText color="accent">
                {lookupResult.status === 'found_online'
                  ? t('barcode.foundOnline')
                  : t('barcode.foundLocal')}
              </AppText>
              <AppText color="secondary">
                {t(`food.source.${food.source}`)} · {t(`food.quality.${food.quality}`)}
              </AppText>
              {food.source === 'off' ? (
                <AppText variant="caption" color="secondary">
                  {t('food.offAttribution')}
                </AppText>
              ) : null}
              {lookupResult.status === 'found_online' ? (
                <AppText variant="caption" color="secondary">
                  {t('barcode.cachedHint')}
                </AppText>
              ) : null}
            </Card>
            <Input
              label={t('barcode.servingGrams')}
              value={grams}
              onChangeText={setGrams}
              keyboardType="decimal-pad"
            />
            <Card>
              <AppText variant="bodyStrong">{Math.round(snapshot.energyKcal ?? 0)} kcal</AppText>
              <AppText color="secondary">
                {t('food.nutrients.protein')}: {Math.round((snapshot.proteinG ?? 0) * 10) / 10} g ·{' '}
                {t('food.nutrients.carbs')}: {Math.round((snapshot.carbsG ?? 0) * 10) / 10} g ·{' '}
                {t('food.nutrients.fat')}: {Math.round((snapshot.fatG ?? 0) * 10) / 10} g
              </AppText>
            </Card>
            <View style={styles.actions}>
              <Button
                label={t('barcode.logAction', {
                  kcal: Math.round(snapshot.energyKcal ?? 0),
                })}
                disabled={resolvedGrams <= 0}
                onPress={() => void logFood()}
              />
              <Button label={t('barcode.scanAnother')} variant="secondary" onPress={resetForScan} />
            </View>
          </>
        ) : null}

        {mode === 'missing' && lookupResult ? (
          <>
            <Card>
              <AppText variant="headline">
                {lookupResult.status === 'offline'
                  ? t('barcode.offlineTitle')
                  : t('barcode.notFoundTitle')}
              </AppText>
              <AppText color="secondary">
                {lookupResult.status === 'offline'
                  ? t('barcode.offlineBody')
                  : t('barcode.notFoundBody')}
              </AppText>
              <AppText variant="caption" color="secondary">
                {barcode}
              </AppText>
              {lookupResult.errorCode && lookupResult.errorCode !== 'offline' ? (
                <AppText color="danger">{t(`barcode.errors.${lookupResult.errorCode}`)}</AppText>
              ) : null}
            </Card>
            <View style={styles.actions}>
              <Button label={t('barcode.createFood')} onPress={() => setMode('custom')} />
              <Button label={t('barcode.scanAnother')} variant="secondary" onPress={resetForScan} />
            </View>
          </>
        ) : null}

        {mode === 'custom' ? (
          <BarcodeCustomFoodForm
            barcode={barcode}
            onCancel={() => setMode('missing')}
            onSaved={(saved) => {
              setLookupResult({
                barcode,
                status: 'found_local',
                food: saved,
                errorCode: null,
              });
              setGrams(String(saved.servingGrams ?? 100));
              setMode('result');
            }}
          />
        ) : null}

        {mode === 'history' ? (
          <>
            <View style={styles.actions}>
              <Button label={t('common.back')} variant="ghost" onPress={resetForScan} />
              <Button
                label={t('barcode.manualEntry')}
                variant="secondary"
                onPress={() => setMode('manual')}
              />
            </View>
            {error ? <AppText color="danger">{error}</AppText> : null}
            {historyLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : history.length === 0 ? (
              <AppText color="secondary">{t('barcode.emptyHistory')}</AppText>
            ) : (
              history.map((entry) => (
                <Card
                  key={entry.id}
                  onPress={
                    entry.food
                      ? () => {
                          setLookupResult({
                            barcode: entry.barcode,
                            status: 'found_local',
                            food: entry.food,
                            errorCode: null,
                          });
                          setBarcode(entry.barcode);
                          setGrams(String(entry.food?.servingGrams ?? 100));
                          setMode('result');
                        }
                      : undefined
                  }
                >
                  <AppText variant="bodyStrong">
                    {entry.food
                      ? displayName(entry.food, i18n.language)
                      : t('barcode.unknownProduct')}
                  </AppText>
                  <AppText color="secondary">{entry.barcode}</AppText>
                  <AppText variant="caption" color="accent">
                    {t(`barcode.statuses.${entry.status}`)} ·{' '}
                    {new Date(entry.scannedAt).toLocaleString(i18n.language)}
                  </AppText>
                </Card>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

function BarcodeCustomFoodForm({
  barcode,
  onCancel,
  onSaved,
}: {
  barcode: string;
  onCancel: () => void;
  onSaved: (food: Food) => void;
}) {
  const database = useDatabase();
  const { t } = useTranslation();
  const foods = useMemo(() => createFoodRepository(database), [database]);
  const [name, setName] = useState('');
  const [nameEl, setNameEl] = useState('');
  const [energy, setEnergy] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [servingName, setServingName] = useState('');
  const [servingGrams, setServingGrams] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const grams = optionalNumber(servingGrams);
    const form = customFoodInputSchema.safeParse({
      name,
      nameEl: nameEl.trim() || null,
      energyKcal: optionalNumber(energy),
      proteinG: optionalNumber(protein),
      carbsG: optionalNumber(carbs),
      fatG: optionalNumber(fat),
      servingName: servingName.trim() || null,
      servingGrams: grams && grams > 0 ? grams : null,
    });
    if (!form.success) {
      setError(t('barcode.customInvalid'));
      return;
    }
    try {
      const saved = await foods.create({
        id: createId(),
        name: form.data.name,
        nameEl: form.data.nameEl,
        brand: null,
        barcode,
        source: 'user',
        externalId: null,
        sourceUpdatedAt: null,
        quality: 'user_entered',
        novaClass: null,
        isLiquid: false,
        servingName: form.data.servingName,
        servingGrams: form.data.servingGrams,
        energyKcal: form.data.energyKcal,
        proteinG: form.data.proteinG,
        carbsG: form.data.carbsG,
        fatG: form.data.fatG,
        satFatG: null,
        monoFatG: null,
        polyFatG: null,
        fiberG: null,
        sugarG: null,
        saltG: null,
        sodiumMg: null,
        cholesterolMg: null,
        micros: null,
      });
      if (form.data.servingName && form.data.servingGrams) {
        await foods.createPortion({
          id: createId(),
          foodId: saved.id,
          label: form.data.servingName,
          labelEl: null,
          grams: form.data.servingGrams,
        });
      }
      onSaved(saved);
    } catch {
      setError(t('barcode.errors.local'));
    }
  };

  return (
    <>
      <AppText color="secondary">{t('barcode.customBarcode', { barcode })}</AppText>
      <Input label={t('food.custom.name')} value={name} onChangeText={setName} />
      <Input label={t('food.custom.nameEl')} value={nameEl} onChangeText={setNameEl} />
      <Input
        label={t('food.custom.energy')}
        value={energy}
        onChangeText={setEnergy}
        keyboardType="decimal-pad"
      />
      <View style={styles.formRow}>
        <View style={styles.formField}>
          <Input
            label={t('food.nutrients.protein')}
            value={protein}
            onChangeText={setProtein}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.formField}>
          <Input
            label={t('food.nutrients.carbs')}
            value={carbs}
            onChangeText={setCarbs}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.formField}>
          <Input
            label={t('food.nutrients.fat')}
            value={fat}
            onChangeText={setFat}
            keyboardType="decimal-pad"
          />
        </View>
      </View>
      <Input
        label={t('food.custom.servingName')}
        value={servingName}
        onChangeText={setServingName}
      />
      <Input
        label={t('food.custom.servingGrams')}
        value={servingGrams}
        onChangeText={setServingGrams}
        keyboardType="decimal-pad"
      />
      {error ? <AppText color="danger">{error}</AppText> : null}
      <View style={styles.actions}>
        <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
        <Button label={t('common.save')} onPress={() => void save()} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 680 },
  content: { gap: spacing.md, paddingBottom: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  cameraFrame: {
    height: 340,
    overflow: 'hidden',
    borderRadius: radii.lg,
    position: 'relative',
  },
  camera: { flex: 1 },
  scanWindow: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    top: '34%',
    height: 110,
    borderWidth: 3,
    borderRadius: radii.md,
  },
  formRow: { flexDirection: 'row', gap: spacing.sm },
  formField: { flex: 1 },
});
