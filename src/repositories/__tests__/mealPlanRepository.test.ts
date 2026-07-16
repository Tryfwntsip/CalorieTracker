import { initializeDatabase } from '@/db/initialize';
import { createMealPlanRepository } from '@/repositories';
import { createTestDatabase, type TestDatabase } from '@/test/sqlite';

describe('meal plan repository', () => {
  let database: TestDatabase;
  let sequence = 0;
  const clock = { now: () => `2026-07-16T08:00:0${sequence++}.000Z` };

  beforeEach(async () => {
    sequence = 0;
    database = createTestDatabase();
    await initializeDatabase(database);
  });
  afterEach(() => database.close());

  it('assigns exactly one source per slot and replaces an existing assignment', async () => {
    const repository = createMealPlanRepository(database, clock);
    const plan = await repository.create({ id: 'plan', weekStart: '2026-07-13' });
    const recipeEntry = await repository.saveEntry({
      id: 'recipe-entry',
      planId: plan.id,
      dayDate: '2026-07-13',
      section: 'lunch',
      recipeId: 'seed-recipe-001',
      foodId: null,
      templateId: null,
      quantity: 1,
      position: 0,
    });
    expect(recipeEntry.label).toBe('Lentil and tomato bowl');
    await repository.saveEntry({
      id: 'food-entry',
      planId: plan.id,
      dayDate: '2026-07-13',
      section: 'lunch',
      recipeId: null,
      foodId: 'greek-food-031',
      templateId: null,
      quantity: 180,
      position: 0,
    });
    expect(await repository.listEntries(plan.id)).toMatchObject([
      { foodId: 'greek-food-031', recipeId: null, label: 'Apple' },
    ]);
    await expect(
      database.runAsync(
        `INSERT INTO meal_plan_entries (
          id, plan_id, day_date, section, recipe_id, food_id, template_id,
          quantity, position, created_at, updated_at
        ) VALUES ('invalid', ?, '2026-07-14', 'lunch', NULL, NULL, NULL, 1, 0, ?, ?)`,
        plan.id,
        clock.now(),
        clock.now(),
      ),
    ).rejects.toThrow();
  });

  it('copies a week and replaces the target week atomically', async () => {
    const repository = createMealPlanRepository(database, clock);
    const source = await repository.create({ id: 'source', weekStart: '2026-07-13' });
    await repository.saveEntry({
      id: 'entry',
      planId: source.id,
      dayDate: '2026-07-15',
      section: 'dinner',
      recipeId: 'seed-recipe-002',
      foodId: null,
      templateId: null,
      quantity: 2,
      position: 0,
    });
    const target = await repository.replaceWeek(
      source.id,
      { id: 'target', weekStart: '2026-07-20' },
      ['2026-07-22'],
      ['copied'],
    );
    expect(await repository.listEntries(target.id)).toMatchObject([
      { dayDate: '2026-07-22', recipeId: 'seed-recipe-002', quantity: 2 },
    ]);
  });
});
