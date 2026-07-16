import type { Database } from '@/db/types';
import { createDiaryRepository, createFoodRepository } from '@/repositories';

type CountRow = { count: number };

type DevelopmentSeedOptions = {
  isDevelopment: boolean;
  dayDate: string;
  now: string;
};

const foodIds = {
  lentils: '0190f000-0000-7000-8000-000000000001',
  yogurt: '0190f000-0000-7000-8000-000000000002',
  salad: '0190f000-0000-7000-8000-000000000003',
} as const;

async function tablesAreEmpty(database: Database): Promise<boolean> {
  const row = await database.getFirstAsync<CountRow>(`
    SELECT
      (SELECT COUNT(*) FROM foods) +
      (SELECT COUNT(*) FROM food_portions) +
      (SELECT COUNT(*) FROM diary_days) +
      (SELECT COUNT(*) FROM diary_entries) AS count
  `);
  return (row?.count ?? 0) === 0;
}

export async function seedDevelopmentData(
  database: Database,
  options: DevelopmentSeedOptions,
): Promise<boolean> {
  if (!options.isDevelopment) return false;

  return database.withTransactionAsync(async (transaction) => {
    if (!(await tablesAreEmpty(transaction))) return false;

    const clock = { now: () => options.now };
    const foods = createFoodRepository(transaction, clock);
    const diary = createDiaryRepository(transaction, clock);

    await foods.create({
      id: foodIds.lentils,
      name: 'Cooked lentils',
      nameEl: 'Φακές μαγειρεμένες',
      brand: null,
      barcode: null,
      source: 'greek_seed',
      externalId: 'dev-lentils',
      sourceUpdatedAt: null,
      quality: 'complete',
      novaClass: 1,
      isLiquid: false,
      servingName: 'bowl',
      servingGrams: 250,
      energyKcal: 116,
      proteinG: 9,
      carbsG: 20.1,
      fatG: 0.4,
      satFatG: 0.1,
      monoFatG: null,
      polyFatG: null,
      fiberG: 7.9,
      sugarG: 1.8,
      saltG: 0.3,
      sodiumMg: 118,
      cholesterolMg: 0,
      micros: { iron_mg: 3.3, potassium_mg: 369 },
    });
    await foods.createPortion({
      id: '0190f100-0000-7000-8000-000000000001',
      foodId: foodIds.lentils,
      label: 'bowl',
      labelEl: 'μπολ',
      grams: 250,
    });

    await foods.create({
      id: foodIds.yogurt,
      name: 'Greek yogurt 2%',
      nameEl: 'Ελληνικό γιαούρτι 2%',
      brand: null,
      barcode: null,
      source: 'greek_seed',
      externalId: 'dev-yogurt',
      sourceUpdatedAt: null,
      quality: 'complete',
      novaClass: 1,
      isLiquid: false,
      servingName: 'tub',
      servingGrams: 200,
      energyKcal: 73,
      proteinG: 9.9,
      carbsG: 3.9,
      fatG: 2,
      satFatG: 1.3,
      monoFatG: null,
      polyFatG: null,
      fiberG: 0,
      sugarG: 3.9,
      saltG: 0.1,
      sodiumMg: 40,
      cholesterolMg: 10,
      micros: { calcium_mg: 110 },
    });
    await foods.createPortion({
      id: '0190f100-0000-7000-8000-000000000002',
      foodId: foodIds.yogurt,
      label: 'tub',
      labelEl: 'κεσεδάκι',
      grams: 200,
    });

    await foods.create({
      id: foodIds.salad,
      name: 'Village salad',
      nameEl: 'Χωριάτικη σαλάτα',
      brand: null,
      barcode: null,
      source: 'greek_seed',
      externalId: 'dev-village-salad',
      sourceUpdatedAt: null,
      quality: 'complete',
      novaClass: 1,
      isLiquid: false,
      servingName: 'plate',
      servingGrams: 300,
      energyKcal: 102,
      proteinG: 3,
      carbsG: 5,
      fatG: 8,
      satFatG: 2.5,
      monoFatG: null,
      polyFatG: null,
      fiberG: 1.7,
      sugarG: 3.6,
      saltG: 0.8,
      sodiumMg: 315,
      cholesterolMg: 8,
      micros: { vit_c_mg: 16, potassium_mg: 220 },
    });
    await foods.createPortion({
      id: '0190f100-0000-7000-8000-000000000003',
      foodId: foodIds.salad,
      label: 'plate',
      labelEl: 'πιάτο',
      grams: 300,
    });

    await diary.createDay({ date: options.dayDate, mood: null, note: null });
    await diary.createEntry({
      id: '0190f200-0000-7000-8000-000000000001',
      dayDate: options.dayDate,
      section: 'lunch',
      foodId: foodIds.lentils,
      customLabel: null,
      quantity: 250,
      unit: 'g',
      gramsResolved: 250,
      energyKcal: 290,
      proteinG: 22.5,
      carbsG: 50.25,
      fatG: 1,
      satFatG: 0.25,
      fiberG: 19.75,
      sugarG: 4.5,
      sodiumMg: 295,
      microsSnapshot: { iron_mg: 8.25, potassium_mg: 922.5 },
      loggedVia: 'search',
      deletedAt: null,
    });
    await diary.createEntry({
      id: '0190f200-0000-7000-8000-000000000002',
      dayDate: options.dayDate,
      section: 'afternoon_snack',
      foodId: foodIds.yogurt,
      customLabel: null,
      quantity: 200,
      unit: 'g',
      gramsResolved: 200,
      energyKcal: 146,
      proteinG: 19.8,
      carbsG: 7.8,
      fatG: 4,
      satFatG: 2.6,
      fiberG: 0,
      sugarG: 7.8,
      sodiumMg: 80,
      microsSnapshot: { calcium_mg: 220 },
      loggedVia: 'search',
      deletedAt: null,
    });

    return true;
  });
}
