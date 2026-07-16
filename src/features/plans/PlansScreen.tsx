import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  matchesRecipeFilters,
  nutritionPerServing,
  type AllergenTag,
  type DietaryTag,
} from '@/domain/recipes';
import { groceryItemFormSchema, groceryListFormSchema, recipeDraftFormSchema } from '@/schemas';
import type { Food } from '@/types';
import { AppText, Button, Card, EmptyState, ErrorState, Input, Screen } from '@/ui/components';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH_TARGET, radii, spacing } from '@/ui/tokens';
import { type RecipeDraft, usePlansData } from './usePlansData';

type Mode = 'recipes' | 'groceries';
type Props = { now?: Date };

function Chip({
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
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <AppText variant="label" color={selected ? 'onPrimary' : 'primary'}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function PlansScreen({ now = new Date() }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const plans = usePlansData(now);
  const [mode, setMode] = useState<Mode>('recipes');
  const [dietary, setDietary] = useState<DietaryTag | null>(null);
  const [allergen, setAllergen] = useState<AllergenTag | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [servings, setServings] = useState('2');
  const [foodQuery, setFoodQuery] = useState('');
  const [grams, setGrams] = useState('100');
  const [draftIngredients, setDraftIngredients] = useState<{ food: Food; grams: number }[]>([]);
  const [listName, setListName] = useState('');
  const [itemLabel, setItemLabel] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [notice, setNotice] = useState<string | null>(null);
  const [rename, setRename] = useState('');

  const ready = plans.state.status === 'ready' ? plans.state : null;
  const filteredRecipes = useMemo(
    () =>
      ready?.recipes.filter((recipe) =>
        matchesRecipeFilters(recipe, dietary, allergen ? [allergen] : []),
      ) ?? [],
    [allergen, dietary, ready],
  );

  if (plans.state.status === 'loading') {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <AppText color="secondary">{t('plans.loading')}</AppText>
        </View>
      </Screen>
    );
  }
  if (plans.state.status === 'error') {
    return (
      <Screen>
        <ErrorState
          title={t('plans.errorTitle')}
          body={t('plans.errorBody')}
          onRetry={() => void plans.retry()}
        />
      </Screen>
    );
  }

  const state = plans.state;
  const recipe = state.selectedRecipe;
  const nutrition = recipe ? nutritionPerServing(state.ingredients, recipe.servings) : null;

  const addDraftFood = (food: Food) => {
    const amount = Number(grams.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) return;
    setDraftIngredients((current) => [...current, { food, grams: amount }]);
    setFoodQuery('');
  };

  const saveDraft = async () => {
    const parsed = recipeDraftFormSchema.safeParse({
      title,
      servings: Number(servings.replace(',', '.')),
      ingredients: draftIngredients.map(({ food, grams: amount }) => ({
        foodId: food.id,
        grams: amount,
      })),
    });
    if (!parsed.success) {
      setNotice(t('plans.recipe.invalid'));
      return;
    }
    const draft: RecipeDraft = {
      title: parsed.data.title,
      servings: parsed.data.servings,
      ingredients: draftIngredients,
    };
    await plans.saveRecipe(draft);
    setEditing(false);
    setTitle('');
    setDraftIngredients([]);
    setNotice(t('plans.recipe.saved'));
  };

  return (
    <Screen>
      <View>
        <AppText variant="title">{t('plans.title')}</AppText>
        <AppText color="secondary">{t('plans.subtitle')}</AppText>
      </View>
      <View style={styles.row}>
        <Chip
          label={t('plans.recipes')}
          selected={mode === 'recipes'}
          onPress={() => setMode('recipes')}
        />
        <Chip
          label={t('plans.groceries')}
          selected={mode === 'groceries'}
          onPress={() => setMode('groceries')}
        />
      </View>
      {notice ? (
        <Card>
          <AppText color="accent">{notice}</AppText>
        </Card>
      ) : null}

      {mode === 'recipes' ? (
        <>
          <View style={styles.row}>
            {(['vegetarian', 'vegan', 'pescatarian', 'gluten_free'] as const).map((tag) => (
              <Chip
                key={tag}
                label={t(`plans.tags.${tag}`)}
                selected={dietary === tag}
                onPress={() => setDietary((value) => (value === tag ? null : tag))}
              />
            ))}
          </View>
          <View style={styles.row}>
            {(['dairy', 'egg', 'fish', 'nuts', 'gluten'] as const).map((tag) => (
              <Chip
                key={tag}
                label={t('plans.exclude', { allergen: t(`plans.allergens.${tag}`) })}
                selected={allergen === tag}
                onPress={() => setAllergen((value) => (value === tag ? null : tag))}
              />
            ))}
          </View>
          <Button
            label={editing ? t('common.cancel') : t('plans.recipe.create')}
            variant="secondary"
            onPress={() => setEditing((value) => !value)}
          />
          {editing ? (
            <Card style={styles.card}>
              <AppText variant="headline">{t('plans.recipe.create')}</AppText>
              <Input label={t('plans.recipe.title')} value={title} onChangeText={setTitle} />
              <Input
                label={t('plans.recipe.servings')}
                value={servings}
                onChangeText={setServings}
                keyboardType="decimal-pad"
              />
              <Input
                label={t('plans.recipe.findIngredient')}
                value={foodQuery}
                onChangeText={setFoodQuery}
              />
              <Input
                label={t('plans.recipe.grams')}
                value={grams}
                onChangeText={setGrams}
                keyboardType="decimal-pad"
              />
              <Button
                label={t('plans.recipe.search')}
                variant="secondary"
                onPress={() => void plans.searchFoods(foodQuery)}
              />
              {state.foodResults.map((food) => (
                <Button
                  key={food.id}
                  label={i18n.language === 'el' ? (food.nameEl ?? food.name) : food.name}
                  variant="ghost"
                  onPress={() => addDraftFood(food)}
                />
              ))}
              {draftIngredients.map(({ food, grams: amount }, index) => (
                <AppText key={`${food.id}-${index}`}>
                  {food.name} · {amount} {t('plans.units.g')}
                </AppText>
              ))}
              <Button label={t('common.save')} onPress={() => void saveDraft()} />
            </Card>
          ) : null}

          {recipe ? (
            <Card style={styles.card}>
              <View style={styles.between}>
                <AppText variant="headline">
                  {i18n.language === 'el' ? (recipe.titleEl ?? recipe.title) : recipe.title}
                </AppText>
                <Button
                  label={t('common.close')}
                  variant="ghost"
                  onPress={() => void plans.selectRecipe(null)}
                />
              </View>
              <AppText color="secondary">
                {t('plans.recipe.time', {
                  minutes: recipe.prepMinutes + recipe.cookMinutes,
                  servings: recipe.servings,
                })}
              </AppText>
              <AppText>
                {t('plans.recipe.nutrition', {
                  kcal: nutrition?.energyKcal?.toFixed(0) ?? '—',
                  protein: nutrition?.proteinG?.toFixed(1) ?? '—',
                  carbs: nutrition?.carbsG?.toFixed(1) ?? '—',
                  fat: nutrition?.fatG?.toFixed(1) ?? '—',
                })}
              </AppText>
              {state.ingredients.map((ingredient) => (
                <AppText key={ingredient.id}>
                  {i18n.language === 'el'
                    ? (ingredient.labelEl ?? ingredient.label)
                    : ingredient.label}{' '}
                  · {ingredient.quantity} {t(`plans.units.${ingredient.unit}`)}
                </AppText>
              ))}
              {(i18n.language === 'el'
                ? (recipe.instructionsEl ?? recipe.instructions)
                : recipe.instructions
              ).map((instruction, index) => (
                <AppText key={`${recipe.id}-step-${index}`}>
                  {index + 1}. {instruction}
                </AppText>
              ))}
              <View style={styles.row}>
                <Button
                  label={
                    recipe.isFavorite ? t('plans.recipe.unfavorite') : t('plans.recipe.favorite')
                  }
                  variant="secondary"
                  onPress={() => void plans.toggleFavorite(recipe)}
                />
                <Button
                  label={t('plans.recipe.log')}
                  onPress={() => {
                    void plans
                      .logRecipe(recipe, state.ingredients, 1)
                      .then(() => setNotice(t('plans.recipe.logged')));
                  }}
                />
                <Button
                  label={t('plans.recipe.addToGroceries')}
                  variant="secondary"
                  onPress={() => {
                    void plans
                      .addRecipeToGroceries(state.ingredients, t('plans.grocery.defaultName'))
                      .then(() => setNotice(t('plans.recipe.addedToGroceries')));
                  }}
                />
                {recipe.source === 'user' ? (
                  <>
                    <Button
                      label={t('common.edit')}
                      variant="secondary"
                      onPress={() => setRename(recipe.title)}
                    />
                    <Button
                      label={t('common.delete')}
                      variant="danger"
                      onPress={() => void plans.deleteRecipe(recipe.id)}
                    />
                  </>
                ) : null}
              </View>
              {recipe.source === 'user' && rename ? (
                <View style={styles.card}>
                  <Input label={t('plans.recipe.title')} value={rename} onChangeText={setRename} />
                  <Button
                    label={t('common.save')}
                    onPress={() => {
                      if (!rename.trim()) return;
                      void plans.renameRecipe(recipe, rename).then(() => setRename(''));
                    }}
                  />
                </View>
              ) : null}
            </Card>
          ) : filteredRecipes.length === 0 ? (
            <EmptyState title={t('plans.recipe.emptyFiltered')} />
          ) : (
            filteredRecipes.map((item) => (
              <Card key={item.id} onPress={() => void plans.selectRecipe(item)}>
                <View style={styles.between}>
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong">
                      {i18n.language === 'el' ? (item.titleEl ?? item.title) : item.title}
                    </AppText>
                    <AppText color="secondary">
                      {t('plans.recipe.card', {
                        minutes: item.prepMinutes + item.cookMinutes,
                        servings: item.servings,
                      })}
                    </AppText>
                  </View>
                  <AppText color="accent">{item.isFavorite ? '★' : '☆'}</AppText>
                </View>
              </Card>
            ))
          )}
        </>
      ) : (
        <>
          <Card style={styles.card}>
            <AppText variant="headline">{t('plans.grocery.newList')}</AppText>
            <Input
              label={t('plans.grocery.listName')}
              value={listName}
              onChangeText={setListName}
            />
            <Button
              label={t('common.add')}
              onPress={() => {
                const parsed = groceryListFormSchema.safeParse({ name: listName });
                if (!parsed.success) return;
                void plans.createList(parsed.data.name).then(() => setListName(''));
              }}
            />
          </Card>
          <View style={styles.row}>
            {state.groceries.map((list) => (
              <Chip
                key={list.id}
                label={list.name}
                selected={state.selectedList?.id === list.id}
                onPress={() => void plans.selectList(list)}
              />
            ))}
          </View>
          {state.selectedList ? (
            <>
              <Card style={styles.card}>
                <View style={styles.between}>
                  <AppText variant="headline">{state.selectedList.name}</AppText>
                  <Button
                    label={t('common.delete')}
                    variant="danger"
                    onPress={() => void plans.deleteList(state.selectedList?.id ?? '')}
                  />
                </View>
                <Input
                  label={t('plans.grocery.item')}
                  value={itemLabel}
                  onChangeText={setItemLabel}
                />
                <Input
                  label={t('plans.grocery.quantity')}
                  value={itemQuantity}
                  onChangeText={setItemQuantity}
                  keyboardType="decimal-pad"
                />
                <Button
                  label={t('plans.grocery.addItem')}
                  onPress={() => {
                    const parsed = groceryItemFormSchema.safeParse({
                      label: itemLabel,
                      quantity: Number(itemQuantity.replace(',', '.')),
                    });
                    if (!parsed.success) return;
                    void plans
                      .addManualItem(parsed.data.label, parsed.data.quantity)
                      .then(() => setItemLabel(''));
                  }}
                />
              </Card>
              {state.groceryItems.length === 0 ? (
                <EmptyState title={t('plans.grocery.empty')} />
              ) : (
                state.groceryItems.map((item) => (
                  <Card key={item.id}>
                    <View style={styles.between}>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: item.isChecked }}
                        onPress={() => void plans.toggleItem(item)}
                        style={styles.item}
                      >
                        <AppText>{item.isChecked ? '☑' : '☐'}</AppText>
                        <AppText style={item.isChecked ? styles.checked : undefined}>
                          {item.label} · {item.quantity} {t(`plans.units.${item.unit}`)}
                        </AppText>
                      </Pressable>
                      <Button
                        label={t('common.delete')}
                        variant="ghost"
                        onPress={() => void plans.deleteItem(item)}
                      />
                    </View>
                  </Card>
                ))
              )}
            </>
          ) : (
            <EmptyState title={t('plans.grocery.noLists')} />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
  },
  card: { gap: spacing.md },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  flex: { flex: 1 },
  item: {
    minHeight: MIN_TOUCH_TARGET,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checked: { textDecorationLine: 'line-through', opacity: 0.65 },
});
