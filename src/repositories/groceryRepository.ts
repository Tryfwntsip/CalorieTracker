import type { Database } from '@/db/types';
import { assertChanged, mapRepositoryError, parseRecord } from '@/repositories/errors';
import { systemClock, type Clock } from '@/repositories/shared';
import { groceryItemSchema, groceryListSchema } from '@/schemas';
import type { GroceryItem, GroceryItemWrite, GroceryList, GroceryListWrite } from '@/types';

const selectList = `
SELECT id, name, created_at AS createdAt, updated_at AS updatedAt FROM grocery_lists
`;
const selectItem = `
SELECT id, list_id AS listId, food_id AS foodId, label, quantity, unit,
  grams_resolved AS gramsResolved, is_checked AS isChecked, position,
  created_at AS createdAt, updated_at AS updatedAt FROM grocery_items
`;

export interface GroceryRepository {
  list(): Promise<GroceryList[]>;
  get(id: string): Promise<GroceryList | null>;
  create(list: GroceryListWrite): Promise<GroceryList>;
  update(list: GroceryListWrite): Promise<GroceryList>;
  delete(id: string): Promise<void>;
  listItems(listId: string): Promise<GroceryItem[]>;
  saveItem(item: GroceryItemWrite): Promise<GroceryItem>;
  deleteItem(id: string): Promise<void>;
}

export function createGroceryRepository(
  database: Database,
  clock: Clock = systemClock,
): GroceryRepository {
  const get = async (id: string): Promise<GroceryList | null> => {
    try {
      const row = await database.getFirstAsync<unknown>(`${selectList} WHERE id = ?`, id);
      return row === null ? null : parseRecord(groceryListSchema, row, 'grocery_list');
    } catch (error: unknown) {
      throw mapRepositoryError(error, 'grocery_list');
    }
  };
  const getItem = async (id: string): Promise<GroceryItem | null> => {
    const row = await database.getFirstAsync<unknown>(`${selectItem} WHERE id = ?`, id);
    return row === null ? null : parseRecord(groceryItemSchema, row, 'grocery_item');
  };

  return {
    get,
    async list() {
      try {
        const rows = await database.getAllAsync<unknown>(
          `${selectList} ORDER BY updated_at DESC, id`,
        );
        return rows.map((row) => parseRecord(groceryListSchema, row, 'grocery_list'));
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'grocery_list');
      }
    },
    async create(list) {
      try {
        const now = clock.now();
        await database.runAsync(
          'INSERT INTO grocery_lists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
          list.id,
          list.name,
          now,
          now,
        );
        const created = await get(list.id);
        if (!created) throw new Error('Inserted grocery list was not found.');
        return created;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'grocery_list');
      }
    },
    async update(list) {
      try {
        const result = await database.runAsync(
          'UPDATE grocery_lists SET name = ?, updated_at = ? WHERE id = ?',
          list.name,
          clock.now(),
          list.id,
        );
        assertChanged(result.changes, 'grocery_list');
        const updated = await get(list.id);
        if (!updated) throw new Error('Updated grocery list was not found.');
        return updated;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'grocery_list');
      }
    },
    async delete(id) {
      try {
        const result = await database.runAsync('DELETE FROM grocery_lists WHERE id = ?', id);
        assertChanged(result.changes, 'grocery_list');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'grocery_list');
      }
    },
    async listItems(listId) {
      try {
        const rows = await database.getAllAsync<unknown>(
          `${selectItem} WHERE list_id = ? ORDER BY position, id`,
          listId,
        );
        return rows.map((row) => parseRecord(groceryItemSchema, row, 'grocery_item'));
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'grocery_item');
      }
    },
    async saveItem(item) {
      try {
        const now = clock.now();
        await database.runAsync(
          `INSERT INTO grocery_items (
            id, list_id, food_id, label, quantity, unit, grams_resolved,
            is_checked, position, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            list_id = excluded.list_id, food_id = excluded.food_id,
            label = excluded.label, quantity = excluded.quantity, unit = excluded.unit,
            grams_resolved = excluded.grams_resolved,
            is_checked = excluded.is_checked, position = excluded.position,
            updated_at = excluded.updated_at`,
          item.id,
          item.listId,
          item.foodId,
          item.label,
          item.quantity,
          item.unit,
          item.gramsResolved,
          item.isChecked ? 1 : 0,
          item.position,
          now,
          now,
        );
        await database.runAsync(
          'UPDATE grocery_lists SET updated_at = ? WHERE id = ?',
          now,
          item.listId,
        );
        const saved = await getItem(item.id);
        if (!saved) throw new Error('Saved grocery item was not found.');
        return saved;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'grocery_item');
      }
    },
    async deleteItem(id) {
      try {
        const result = await database.runAsync('DELETE FROM grocery_items WHERE id = ?', id);
        assertChanged(result.changes, 'grocery_item');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'grocery_item');
      }
    },
  };
}
