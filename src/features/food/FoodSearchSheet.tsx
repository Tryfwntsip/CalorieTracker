import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDatabase } from '@/db/DatabaseProvider';
import { foodSnapshotForGrams } from '@/domain/food';
import { createId } from '@/lib/id';
import {
  createDiaryRepository,
  createFoodRepository,
  createMealTemplateRepository,
} from '@/repositories';
import { customFoodInputSchema, foodLogInputSchema, mealTemplateFormSchema } from '@/schemas';
import { FoodDataError } from '@/services/food-data/types';
import { searchAndCacheExternalFoods } from '@/services/food-data/search';
import type { Food, FoodPortion, MealTemplate, MealTemplateItemWrite } from '@/types';
import { AppText, Button, Card, Input, Sheet } from '@/ui/components';
import { useTheme } from '@/ui/theme';
import { radii, spacing } from '@/ui/tokens';

type BrowseMode = 'all' | 'favorites' | 'recents' | 'templates' | 'custom';
type FoodUnit = 'g' | 'ml' | 'serving' | 'piece' | 'tsp' | 'tbsp';

type Props = {
  visible: boolean;
  dayDate: string;
  section: string;
  onClose: () => void;
  onLogged: () => Promise<void>;
};

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function displayName(food: Food, language: string): string {
  return language === 'el' ? (food.nameEl ?? food.name) : food.name;
}

export function FoodSearchSheet({ visible, dayDate, section, onClose, onLogged }: Props) {
  const database = useDatabase();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const foods = useMemo(() => createFoodRepository(database), [database]);
  const diary = useMemo(() => createDiaryRepository(database), [database]);
  const templates = useMemo(() => createMealTemplateRepository(database), [database]);
  const [mode, setMode] = useState<BrowseMode>('all');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [templateResults, setTemplateResults] = useState<MealTemplate[]>([]);
  const [selected, setSelected] = useState<Food | null>(null);
  const [editing, setEditing] = useState<Food | 'new' | null>(null);
  const [loading, setLoading] = useState(false);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');

  const loadMode = useCallback(
    async (nextMode: BrowseMode) => {
      setLoading(true);
      setError(null);
      try {
        if (nextMode === 'favorites') setResults(await foods.listFavorites());
        else if (nextMode === 'recents') setResults(await foods.listRecents());
        else if (nextMode === 'custom') {
          setResults((await foods.list()).filter((food) => food.source === 'user'));
        } else if (nextMode === 'templates') {
          setTemplateResults(await templates.list());
        } else {
          setResults((await foods.list()).slice(0, 40));
        }
      } catch {
        setError(t('food.errors.local'));
      } finally {
        setLoading(false);
      }
    },
    [foods, t, templates],
  );

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => void loadMode(mode), 0);
    return () => clearTimeout(timer);
  }, [loadMode, mode, visible]);

  const chooseMode = (nextMode: BrowseMode) => {
    setMode(nextMode);
    setSelected(null);
    setEditing(null);
    setError(null);
  };

  const searchLocal = async () => {
    if (!query.trim()) {
      await loadMode('all');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResults(await foods.search(query));
      setMode('all');
    } catch {
      setError(t('food.errors.local'));
    } finally {
      setLoading(false);
    }
  };

  const searchOnline = async () => {
    if (!query.trim()) return;
    setOnlineLoading(true);
    setError(null);
    try {
      const external = await searchAndCacheExternalFoods(
        database,
        query,
        i18n.language === 'el' ? 'el' : 'en',
      );
      setResults(external);
      setMode('all');
      if (external.length === 0) setError(t('food.errors.noOnlineResults'));
    } catch (caught: unknown) {
      if (caught instanceof FoodDataError) {
        setError(t(`food.errors.${caught.code}`));
      } else {
        setError(t('food.errors.server'));
      }
    } finally {
      setOnlineLoading(false);
    }
  };

  const saveCurrentMeal = async () => {
    const entries = (await diary.listEntries(dayDate)).filter(
      (entry) =>
        entry.deletedAt === null &&
        entry.section === section &&
        entry.foodId !== null &&
        entry.gramsResolved !== null,
    );
    const form = mealTemplateFormSchema.safeParse({ name: templateName });
    if (!form.success || entries.length === 0) {
      setError(t('food.templates.emptyMeal'));
      return;
    }
    const items: MealTemplateItemWrite[] = [];
    for (const entry of entries) {
      if (entry.foodId === null || entry.gramsResolved === null) continue;
      items.push({
        id: createId(),
        templateId: '',
        foodId: entry.foodId,
        grams: entry.gramsResolved,
        position: items.length,
      });
    }
    await templates.create({ id: createId(), name: form.data.name }, items);
    setTemplateName('');
    await loadMode('templates');
  };

  const logTemplate = async (template: MealTemplate) => {
    const items = await templates.listItems(template.id);
    for (const item of items) {
      const food = await foods.get(item.foodId);
      if (!food) continue;
      const snapshot = foodSnapshotForGrams(food, item.grams);
      await diary.createEntry({
        id: createId(),
        dayDate,
        section,
        foodId: food.id,
        customLabel: null,
        quantity: item.grams,
        unit: 'g',
        gramsResolved: item.grams,
        ...snapshot,
        loggedVia: 'template',
        deletedAt: null,
      });
      await foods.markRecent(food.id);
    }
    await onLogged();
    onClose();
  };

  const title = selected
    ? displayName(selected, i18n.language)
    : editing
      ? editing === 'new'
        ? t('food.custom.newTitle')
        : t('food.custom.editTitle')
      : t('food.title');

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        setSelected(null);
        setEditing(null);
        onClose();
      }}
      title={title}
    >
      {selected ? (
        <FoodDetail
          food={selected}
          dayDate={dayDate}
          section={section}
          loggedVia={mode === 'favorites' ? 'favorite' : mode === 'recents' ? 'recent' : 'search'}
          onBack={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected);
            setSelected(null);
          }}
          onLogged={async () => {
            await onLogged();
            onClose();
          }}
        />
      ) : editing ? (
        <CustomFoodForm
          food={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await loadMode(mode);
          }}
        />
      ) : (
        <>
          <View style={styles.modes}>
            {(['all', 'favorites', 'recents', 'templates', 'custom'] as const).map((item) => (
              <Choice
                key={item}
                label={t(`food.modes.${item}`)}
                selected={mode === item}
                onPress={() => chooseMode(item)}
              />
            ))}
          </View>

          {mode === 'all' ? (
            <>
              <Input
                label={t('food.searchLabel')}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                onSubmitEditing={() => void searchLocal()}
              />
              <View style={styles.actions}>
                <Button label={t('food.searchLocal')} onPress={() => void searchLocal()} />
                <Button
                  label={t('food.searchOnline')}
                  variant="secondary"
                  loading={onlineLoading}
                  disabled={!query.trim()}
                  onPress={() => void searchOnline()}
                />
              </View>
              <AppText variant="caption" color="secondary">
                {t('food.onlineHint')}
              </AppText>
            </>
          ) : null}

          {mode === 'custom' ? (
            <Button label={t('food.custom.create')} onPress={() => setEditing('new')} />
          ) : null}

          {mode === 'templates' ? (
            <View style={styles.templateCreate}>
              <Input
                label={t('food.templates.name')}
                value={templateName}
                onChangeText={setTemplateName}
              />
              <Button
                label={t('food.templates.saveCurrent')}
                disabled={!templateName.trim()}
                onPress={() => void saveCurrentMeal()}
              />
            </View>
          ) : null}

          {error ? <AppText color="danger">{error}</AppText> : null}
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <ScrollView style={styles.results} contentContainerStyle={styles.resultContent}>
              {mode === 'templates'
                ? templateResults.map((template) => (
                    <Card key={template.id} onPress={() => void logTemplate(template)}>
                      <AppText variant="bodyStrong">{template.name}</AppText>
                      <AppText color="secondary">{t('food.templates.log')}</AppText>
                    </Card>
                  ))
                : results.map((food) => (
                    <FoodResult
                      key={food.id}
                      food={food}
                      language={i18n.language}
                      onPress={() => setSelected(food)}
                    />
                  ))}
              {(mode === 'templates' ? templateResults : results).length === 0 ? (
                <AppText color="secondary">{t('food.empty')}</AppText>
              ) : null}
            </ScrollView>
          )}
        </>
      )}
    </Sheet>
  );
}

function FoodResult({
  food,
  language,
  onPress,
}: {
  food: Food;
  language: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card onPress={onPress}>
      <View style={styles.resultRow}>
        <View style={styles.resultCopy}>
          <AppText variant="bodyStrong">{displayName(food, language)}</AppText>
          <AppText color="secondary">
            {food.brand
              ? `${food.brand} · ${t('food.per100', { kcal: Math.round(food.energyKcal ?? 0) })}`
              : t('food.per100', { kcal: Math.round(food.energyKcal ?? 0) })}
          </AppText>
        </View>
        <AppText variant="caption" color="accent">
          {t(`food.source.${food.source}`)}
        </AppText>
      </View>
    </Card>
  );
}

function FoodDetail({
  food,
  dayDate,
  section,
  loggedVia,
  onBack,
  onEdit,
  onLogged,
}: {
  food: Food;
  dayDate: string;
  section: string;
  loggedVia: 'search' | 'favorite' | 'recent';
  onBack: () => void;
  onEdit: () => void;
  onLogged: () => Promise<void>;
}) {
  const database = useDatabase();
  const { t, i18n } = useTranslation();
  const foods = useMemo(() => createFoodRepository(database), [database]);
  const diary = useMemo(() => createDiaryRepository(database), [database]);
  const [portions, setPortions] = useState<FoodPortion[]>([]);
  const [unit, setUnit] = useState<FoodUnit>('serving');
  const [portion, setPortion] = useState<FoodPortion | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([foods.listPortions(food.id), foods.isFavorite(food.id)])
      .then(([nextPortions, isFavorite]) => {
        if (!active) return;
        setPortions(nextPortions);
        setPortion(nextPortions[0] ?? null);
        setFavorite(isFavorite);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [food.id, foods]);

  const numericQuantity = optionalNumber(quantity) ?? 0;
  const gramsPerUnit =
    portion && unit === 'serving'
      ? portion.grams
      : unit === 'g' || unit === 'ml'
        ? 1
        : unit === 'tsp'
          ? 5
          : unit === 'tbsp'
            ? 15
            : (food.servingGrams ?? 100);
  const grams = numericQuantity * gramsPerUnit;
  const snapshot = foodSnapshotForGrams(food, grams);

  const log = async () => {
    const form = foodLogInputSchema.safeParse({
      quantity: numericQuantity,
      grams,
      unit,
    });
    if (!form.success) return;
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
      loggedVia,
      deletedAt: null,
    });
    await foods.markRecent(food.id);
    await onLogged();
  };

  return (
    <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent}>
      <View style={styles.actions}>
        <Button label={t('common.back')} variant="ghost" onPress={onBack} />
        <Button
          label={favorite ? t('food.removeFavorite') : t('food.addFavorite')}
          variant="secondary"
          onPress={() => {
            void foods.setFavorite(food.id, !favorite);
            setFavorite((value) => !value);
          }}
        />
        <Button label={t('common.edit')} variant="ghost" onPress={onEdit} />
      </View>
      <AppText color="secondary">
        {t(`food.source.${food.source}`)} · {t(`food.quality.${food.quality}`)}
      </AppText>
      {food.source === 'off' ? (
        <AppText variant="caption" color="secondary">
          {t('food.offAttribution')}
        </AppText>
      ) : null}
      <NutritionGrid food={food} grams={100} title={t('food.nutritionPer100')} />
      <View style={styles.modes}>
        {(['g', 'ml', 'serving', 'piece', 'tsp', 'tbsp'] as const).map((item) => (
          <Choice
            key={item}
            label={t(`food.units.${item}`)}
            selected={unit === item}
            onPress={() => {
              setUnit(item);
              if (item !== 'serving') setPortion(null);
            }}
          />
        ))}
      </View>
      {portions.length > 0 ? (
        <View style={styles.modes}>
          {portions.map((item) => (
            <Choice
              key={item.id}
              label={i18n.language === 'el' ? (item.labelEl ?? item.label) : item.label}
              selected={portion?.id === item.id && unit === 'serving'}
              onPress={() => {
                setPortion(item);
                setUnit('serving');
              }}
            />
          ))}
        </View>
      ) : null}
      <Input
        label={t('food.quantity')}
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="decimal-pad"
      />
      <NutritionGrid food={food} grams={grams} title={t('food.selectedNutrition')} />
      <Button
        label={t('food.logAction', { kcal: Math.round(snapshot.energyKcal ?? 0) })}
        fullWidth
        disabled={grams <= 0}
        onPress={() => void log()}
      />
    </ScrollView>
  );
}

function NutritionGrid({ food, grams, title }: { food: Food; grams: number; title: string }) {
  const { t } = useTranslation();
  const snapshot = foodSnapshotForGrams(food, grams);
  const values = [
    ['energy', snapshot.energyKcal, 'kcal'],
    ['protein', snapshot.proteinG, 'g'],
    ['carbs', snapshot.carbsG, 'g'],
    ['fat', snapshot.fatG, 'g'],
    ['satFat', snapshot.satFatG, 'g'],
    ['fiber', snapshot.fiberG, 'g'],
    ['sugar', snapshot.sugarG, 'g'],
    ['sodium', snapshot.sodiumMg, 'mg'],
  ] as const;
  return (
    <Card>
      <AppText variant="headline">{title}</AppText>
      <View style={styles.nutritionGrid}>
        {values.map(([key, value, unit]) => (
          <View key={key} style={styles.nutrient}>
            <AppText variant="caption" color="secondary">
              {t(`food.nutrients.${key}`)}
            </AppText>
            <AppText variant="bodyStrong">
              {value === null ? '—' : `${Math.round(value * 10) / 10} ${unit}`}
            </AppText>
          </View>
        ))}
      </View>
    </Card>
  );
}

function CustomFoodForm({
  food,
  onCancel,
  onSaved,
}: {
  food: Food | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const database = useDatabase();
  const { t } = useTranslation();
  const foods = useMemo(() => createFoodRepository(database), [database]);
  const [name, setName] = useState(food?.name ?? '');
  const [nameEl, setNameEl] = useState(food?.nameEl ?? '');
  const [energy, setEnergy] = useState(food?.energyKcal?.toString() ?? '');
  const [protein, setProtein] = useState(food?.proteinG?.toString() ?? '');
  const [carbs, setCarbs] = useState(food?.carbsG?.toString() ?? '');
  const [fat, setFat] = useState(food?.fatG?.toString() ?? '');
  const [servingName, setServingName] = useState(food?.servingName ?? '');
  const [servingGrams, setServingGrams] = useState(food?.servingGrams?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const energyKcal = optionalNumber(energy);
    const grams = optionalNumber(servingGrams);
    const form = customFoodInputSchema.safeParse({
      name,
      nameEl: nameEl.trim() || null,
      energyKcal,
      proteinG: optionalNumber(protein),
      carbsG: optionalNumber(carbs),
      fatG: optionalNumber(fat),
      servingName: servingName.trim() || null,
      servingGrams: grams && grams > 0 ? grams : null,
    });
    if (!form.success) {
      setError(t('food.custom.invalid'));
      return;
    }
    const base = {
      id: food?.id ?? createId(),
      name: form.data.name,
      nameEl: form.data.nameEl,
      brand: food?.brand ?? null,
      barcode: food?.barcode ?? null,
      source: food?.source ?? ('user' as const),
      externalId: food?.externalId ?? null,
      sourceUpdatedAt: food?.sourceUpdatedAt ?? null,
      quality: food?.source === 'user' || !food ? ('user_entered' as const) : food.quality,
      novaClass: food?.novaClass ?? null,
      isLiquid: food?.isLiquid ?? false,
      servingName: form.data.servingName,
      servingGrams: form.data.servingGrams,
      energyKcal: form.data.energyKcal,
      proteinG: form.data.proteinG,
      carbsG: form.data.carbsG,
      fatG: form.data.fatG,
      satFatG: food?.satFatG ?? null,
      monoFatG: food?.monoFatG ?? null,
      polyFatG: food?.polyFatG ?? null,
      fiberG: food?.fiberG ?? null,
      sugarG: food?.sugarG ?? null,
      saltG: food?.saltG ?? null,
      sodiumMg: food?.sodiumMg ?? null,
      cholesterolMg: food?.cholesterolMg ?? null,
      micros: food?.micros ?? null,
    };

    if (food && food.source !== 'user') {
      await foods.saveOverride({
        foodId: food.id,
        name: base.name,
        nameEl: base.nameEl,
        energyKcal: base.energyKcal,
        proteinG: base.proteinG,
        carbsG: base.carbsG,
        fatG: base.fatG,
        satFatG: base.satFatG,
        fiberG: base.fiberG,
        sugarG: base.sugarG,
        saltG: base.saltG,
        sodiumMg: base.sodiumMg,
      });
    } else if (food) {
      await foods.update(base);
      const existingPortions = await foods.listPortions(base.id);
      const currentPortion = existingPortions[0];
      if (base.servingName && base.servingGrams) {
        if (currentPortion) {
          await foods.updatePortion({
            id: currentPortion.id,
            foodId: base.id,
            label: base.servingName,
            labelEl: null,
            grams: base.servingGrams,
          });
        } else {
          await foods.createPortion({
            id: createId(),
            foodId: base.id,
            label: base.servingName,
            labelEl: null,
            grams: base.servingGrams,
          });
        }
      } else {
        await Promise.all(existingPortions.map((portion) => foods.deletePortion(portion.id)));
      }
    } else {
      await foods.create(base);
      if (base.servingName && base.servingGrams) {
        await foods.createPortion({
          id: createId(),
          foodId: base.id,
          label: base.servingName,
          labelEl: null,
          grams: base.servingGrams,
        });
      }
    }
    await onSaved();
  };

  return (
    <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent}>
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
      {food?.source === 'user' ? (
        <Button
          label={t('common.delete')}
          variant="danger"
          onPress={() => {
            void foods.delete(food.id).then(onSaved);
          }}
        />
      ) : null}
    </ScrollView>
  );
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.choice,
        {
          backgroundColor: selected ? colors.primarySoft : colors.surfaceAlt,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <AppText variant="label" color={selected ? 'accent' : 'primary'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  results: { maxHeight: 430 },
  resultContent: { gap: spacing.sm, paddingBottom: spacing.sm },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  resultCopy: { flex: 1, gap: spacing.xs },
  templateCreate: { gap: spacing.sm },
  detailScroll: { maxHeight: 600 },
  detailContent: { gap: spacing.md, paddingBottom: spacing.md },
  nutritionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  nutrient: { width: '45%', gap: spacing.xs },
  formRow: { flexDirection: 'row', gap: spacing.sm },
  formField: { flex: 1 },
});
