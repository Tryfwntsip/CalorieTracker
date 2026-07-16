import { initializeDatabase } from '@/db/initialize';
import {
  createBarcodeRepository,
  createDiaryRepository,
  createFoodRepository,
  createHealthRecordRepository,
  createProfileRepository,
  createSettingsRepository,
  defaultSettings,
  RepositoryError,
} from '@/repositories';
import { createTestDatabase, type TestDatabase } from '@/test/sqlite';
import type { DiaryEntryWrite, FoodWrite, ProfileWrite } from '@/types';

const firstTimestamp = '2026-07-16T08:00:00.000Z';
const secondTimestamp = '2026-07-16T09:00:00.000Z';

const profileWrite: ProfileWrite = {
  dateOfBirth: '1990-05-12',
  sex: 'unspecified',
  heightCm: 175,
  currentWeightKg: 75,
  targetWeightKg: 70,
  activityLevel: 3,
  goalType: 'maintain',
  weeklyRateKg: 0,
  calorieTarget: 2100,
  proteinTargetG: 100,
  carbsTargetG: 250,
  fatTargetG: 70,
};

const foodWrite: FoodWrite = {
  id: '0190f300-0000-7000-8000-000000000001',
  name: 'Test food',
  nameEl: 'Δοκιμαστικό φαγητό',
  brand: null,
  barcode: '5200000000001',
  source: 'user',
  externalId: null,
  sourceUpdatedAt: null,
  quality: 'user_entered',
  novaClass: null,
  isLiquid: false,
  servingName: 'serving',
  servingGrams: 100,
  energyKcal: 150,
  proteinG: 10,
  carbsG: 20,
  fatG: 4,
  satFatG: 1,
  monoFatG: null,
  polyFatG: null,
  fiberG: 3,
  sugarG: 2,
  saltG: 0.2,
  sodiumMg: 80,
  cholesterolMg: null,
  micros: { iron_mg: 1.2 },
};

const diaryEntryWrite: DiaryEntryWrite = {
  id: '0190f400-0000-7000-8000-000000000001',
  dayDate: '2026-07-16',
  section: 'lunch',
  foodId: foodWrite.id,
  customLabel: null,
  quantity: 100,
  unit: 'g',
  gramsResolved: 100,
  energyKcal: 150,
  proteinG: 10,
  carbsG: 20,
  fatG: 4,
  satFatG: 1,
  fiberG: 3,
  sugarG: 2,
  sodiumMg: 80,
  microsSnapshot: { iron_mg: 1.2 },
  loggedVia: 'search',
  deletedAt: null,
};

describe('repositories', () => {
  let database: TestDatabase;
  let now: string;
  const clock = { now: () => now };

  beforeEach(async () => {
    database = createTestDatabase();
    await initializeDatabase(database);
    now = firstTimestamp;
  });

  afterEach(() => {
    database.close();
  });

  it('supports profile and settings CRUD with maintained timestamps', async () => {
    const profiles = createProfileRepository(database, clock);
    const settings = createSettingsRepository(database, clock);

    const createdProfile = await profiles.create(profileWrite);
    const createdSettings = await settings.create(defaultSettings);
    expect(createdProfile.createdAt).toBe(firstTimestamp);
    expect(createdProfile.updatedAt).toBe(firstTimestamp);
    expect(createdSettings.theme).toBe('system');

    now = secondTimestamp;
    const updatedProfile = await profiles.update({ ...profileWrite, calorieTarget: 2200 });
    const updatedSettings = await settings.updateTheme('dark');
    expect(updatedProfile.calorieTarget).toBe(2200);
    expect(updatedProfile.createdAt).toBe(firstTimestamp);
    expect(updatedProfile.updatedAt).toBe(secondTimestamp);
    expect(updatedSettings.theme).toBe('dark');
    expect(updatedSettings.updatedAt).toBe(secondTimestamp);

    await profiles.delete();
    await settings.delete();
    await expect(profiles.get()).resolves.toBeNull();
    await expect(settings.get()).resolves.toBeNull();
  });

  it('supports food and portion CRUD and validates every returned row with Zod', async () => {
    const foods = createFoodRepository(database, clock);
    const created = await foods.create(foodWrite);
    const portion = await foods.createPortion({
      id: '0190f500-0000-7000-8000-000000000001',
      foodId: foodWrite.id,
      label: 'serving',
      labelEl: 'μερίδα',
      grams: 100,
    });
    expect(created.micros).toEqual({ iron_mg: 1.2 });
    expect(portion.grams).toBe(100);

    now = secondTimestamp;
    const updated = await foods.update({ ...foodWrite, name: 'Updated food' });
    const updatedPortion = await foods.updatePortion({ ...portion, grams: 125 });
    expect(updated.name).toBe('Updated food');
    expect(updated.createdAt).toBe(firstTimestamp);
    expect(updated.updatedAt).toBe(secondTimestamp);
    expect(updatedPortion.grams).toBe(125);
    await expect(foods.list()).resolves.toHaveLength(1);
    await expect(foods.listPortions(foodWrite.id)).resolves.toHaveLength(1);

    await database.runAsync(
      'UPDATE foods SET created_at = ? WHERE id = ?',
      'not-an-iso-timestamp',
      foodWrite.id,
    );
    await expect(foods.get(foodWrite.id)).rejects.toMatchObject({
      code: 'validation',
      entity: 'food',
    } satisfies Partial<RepositoryError>);

    await database.runAsync(
      'UPDATE foods SET created_at = ? WHERE id = ?',
      firstTimestamp,
      foodWrite.id,
    );
    await foods.deletePortion(portion.id);
    await foods.delete(foodWrite.id);
    await expect(foods.get(foodWrite.id)).resolves.toBeNull();
  });

  it('supports diary, weight, and water CRUD while preserving relationships', async () => {
    const profiles = createProfileRepository(database, clock);
    const foods = createFoodRepository(database, clock);
    const diary = createDiaryRepository(database, clock);
    const health = createHealthRecordRepository(database, clock);
    await profiles.create(profileWrite);
    await foods.create(foodWrite);

    const day = await diary.createDay({ date: '2026-07-16', mood: 4, note: null });
    const entry = await diary.createEntry(diaryEntryWrite);
    expect(entry.foodId).toBe(foodWrite.id);
    expect(await diary.listEntries(day.date)).toHaveLength(1);

    now = secondTimestamp;
    const updatedDay = await diary.updateDay({ ...day, mood: 5, note: 'Good day' });
    const updatedEntry = await diary.updateEntry({ ...diaryEntryWrite, quantity: 125 });
    expect(updatedDay.updatedAt).toBe(secondTimestamp);
    expect(updatedEntry.quantity).toBe(125);

    const weight = await health.createWeight({
      id: '0190f600-0000-7000-8000-000000000001',
      dayDate: '2026-07-16',
      weightKg: 74.5,
      origin: 'manual',
      externalUid: null,
    });
    const water = await health.createWater({
      id: '0190f700-0000-7000-8000-000000000001',
      dayDate: '2026-07-16',
      amountMl: 250,
      loggedAt: secondTimestamp,
    });
    expect((await profiles.get())?.currentWeightKg).toBe(74.5);
    expect(await health.listWeights()).toHaveLength(1);
    expect(await health.listWater('2026-07-16')).toHaveLength(1);

    const updatedWeight = await health.updateWeight({ ...weight, weightKg: 74.2 });
    const updatedWater = await health.updateWater({ ...water, amountMl: 500 });
    expect(updatedWeight.weightKg).toBe(74.2);
    expect(updatedWater.amountMl).toBe(500);

    await health.deleteWater(water.id);
    await health.deleteWeight(weight.id);
    await diary.deleteEntry(entry.id);
    await diary.deleteDay(day.date);
    await expect(health.getWater(water.id)).resolves.toBeNull();
    await expect(health.getWeight(weight.id)).resolves.toBeNull();
    await expect(diary.getEntry(entry.id)).resolves.toBeNull();
  });

  it('supports scanned-product cache and scan-history CRUD', async () => {
    const foods = createFoodRepository(database, clock);
    const barcode = createBarcodeRepository(database, clock);
    await foods.create(foodWrite);

    const product = await barcode.createProduct({
      barcode: '5200000000001',
      foodId: foodWrite.id,
      source: 'off',
      rawPayload: { product_name: 'Example' },
      fetchedAt: firstTimestamp,
    });
    const history = await barcode.createHistory({
      id: '0190f800-0000-7000-8000-000000000001',
      barcode: product.barcode,
      status: 'found_online',
      resolvedFoodId: foodWrite.id,
      scannedAt: firstTimestamp,
    });
    expect(product.rawPayload).toEqual({ product_name: 'Example' });
    expect(await barcode.listHistory()).toEqual([history]);

    now = secondTimestamp;
    const updatedProduct = await barcode.updateProduct({
      ...product,
      rawPayload: { product_name: 'Updated' },
      fetchedAt: secondTimestamp,
    });
    const updatedHistory = await barcode.updateHistory({
      ...history,
      status: 'found_local',
      scannedAt: secondTimestamp,
    });
    expect(updatedProduct.updatedAt).toBe(secondTimestamp);
    expect(updatedHistory.status).toBe('found_local');

    await barcode.deleteHistory(history.id);
    await barcode.deleteProduct(product.barcode);
    await expect(barcode.getHistory(history.id)).resolves.toBeNull();
    await expect(barcode.getProduct(product.barcode)).resolves.toBeNull();
  });
});
