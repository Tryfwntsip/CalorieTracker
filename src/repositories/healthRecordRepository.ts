import type { Database } from '@/db/types';
import { waterRecordSchema, weightRecordSchema } from '@/schemas';
import type { WaterRecord, WaterRecordWrite, WeightRecord, WeightRecordWrite } from '@/types';
import { assertChanged, mapRepositoryError, parseRecord } from '@/repositories/errors';
import { systemClock, type Clock } from '@/repositories/shared';

const selectWeight = `
SELECT id, day_date AS dayDate, weight_kg AS weightKg, origin,
  external_uid AS externalUid, created_at AS createdAt, updated_at AS updatedAt
FROM weight_records
`;

const selectWater = `
SELECT id, day_date AS dayDate, amount_ml AS amountMl, logged_at AS loggedAt,
  created_at AS createdAt
FROM water_records
`;

export interface HealthRecordRepository {
  getWeight(id: string): Promise<WeightRecord | null>;
  getWeightForDay(dayDate: string): Promise<WeightRecord | null>;
  listWeights(): Promise<WeightRecord[]>;
  createWeight(record: WeightRecordWrite): Promise<WeightRecord>;
  updateWeight(record: WeightRecordWrite): Promise<WeightRecord>;
  deleteWeight(id: string): Promise<void>;
  getWater(id: string): Promise<WaterRecord | null>;
  listWater(dayDate: string): Promise<WaterRecord[]>;
  createWater(record: WaterRecordWrite): Promise<WaterRecord>;
  updateWater(record: WaterRecordWrite): Promise<WaterRecord>;
  deleteWater(id: string): Promise<void>;
}

async function syncCurrentWeight(database: Database, updatedAt: string): Promise<void> {
  await database.runAsync(
    `UPDATE profile
     SET current_weight_kg = (
       SELECT weight_kg FROM weight_records ORDER BY day_date DESC LIMIT 1
     ), updated_at = ?
     WHERE id = 1`,
    updatedAt,
  );
}

export function createHealthRecordRepository(
  database: Database,
  clock: Clock = systemClock,
): HealthRecordRepository {
  const getWeight = async (id: string): Promise<WeightRecord | null> => {
    try {
      const row = await database.getFirstAsync<unknown>(`${selectWeight} WHERE id = ?`, id);
      return row === null ? null : parseRecord(weightRecordSchema, row, 'weight_record');
    } catch (error: unknown) {
      throw mapRepositoryError(error, 'weight_record');
    }
  };

  const getWater = async (id: string): Promise<WaterRecord | null> => {
    try {
      const row = await database.getFirstAsync<unknown>(`${selectWater} WHERE id = ?`, id);
      return row === null ? null : parseRecord(waterRecordSchema, row, 'water_record');
    } catch (error: unknown) {
      throw mapRepositoryError(error, 'water_record');
    }
  };

  return {
    getWeight,
    async getWeightForDay(dayDate) {
      try {
        const row = await database.getFirstAsync<unknown>(
          `${selectWeight} WHERE day_date = ?`,
          dayDate,
        );
        return row === null ? null : parseRecord(weightRecordSchema, row, 'weight_record');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'weight_record');
      }
    },
    async listWeights() {
      try {
        const rows = await database.getAllAsync<unknown>(
          `${selectWeight} ORDER BY day_date DESC, id`,
        );
        return rows.map((row) => parseRecord(weightRecordSchema, row, 'weight_record'));
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'weight_record');
      }
    },
    async createWeight(record) {
      try {
        const now = clock.now();
        await database.withTransactionAsync(async (transaction) => {
          await transaction.runAsync(
            `INSERT INTO weight_records (
              id, day_date, weight_kg, origin, external_uid, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            record.id,
            record.dayDate,
            record.weightKg,
            record.origin,
            record.externalUid,
            now,
            now,
          );
          await syncCurrentWeight(transaction, now);
        });
        const created = await getWeight(record.id);
        if (!created) throw new Error('Inserted weight record was not found.');
        return created;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'weight_record');
      }
    },
    async updateWeight(record) {
      try {
        const now = clock.now();
        await database.withTransactionAsync(async (transaction) => {
          const result = await transaction.runAsync(
            `UPDATE weight_records SET day_date = ?, weight_kg = ?, origin = ?,
              external_uid = ?, updated_at = ? WHERE id = ?`,
            record.dayDate,
            record.weightKg,
            record.origin,
            record.externalUid,
            now,
            record.id,
          );
          assertChanged(result.changes, 'weight_record');
          await syncCurrentWeight(transaction, now);
        });
        const updated = await getWeight(record.id);
        if (!updated) throw new Error('Updated weight record was not found.');
        return updated;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'weight_record');
      }
    },
    async deleteWeight(id) {
      try {
        const now = clock.now();
        await database.withTransactionAsync(async (transaction) => {
          const result = await transaction.runAsync('DELETE FROM weight_records WHERE id = ?', id);
          assertChanged(result.changes, 'weight_record');
          await syncCurrentWeight(transaction, now);
        });
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'weight_record');
      }
    },
    getWater,
    async listWater(dayDate) {
      try {
        const rows = await database.getAllAsync<unknown>(
          `${selectWater} WHERE day_date = ? ORDER BY logged_at, id`,
          dayDate,
        );
        return rows.map((row) => parseRecord(waterRecordSchema, row, 'water_record'));
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'water_record');
      }
    },
    async createWater(record) {
      try {
        await database.runAsync(
          `INSERT INTO water_records (id, day_date, amount_ml, logged_at, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          record.id,
          record.dayDate,
          record.amountMl,
          record.loggedAt,
          clock.now(),
        );
        const created = await getWater(record.id);
        if (!created) throw new Error('Inserted water record was not found.');
        return created;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'water_record');
      }
    },
    async updateWater(record) {
      try {
        const result = await database.runAsync(
          `UPDATE water_records SET day_date = ?, amount_ml = ?, logged_at = ? WHERE id = ?`,
          record.dayDate,
          record.amountMl,
          record.loggedAt,
          record.id,
        );
        assertChanged(result.changes, 'water_record');
        const updated = await getWater(record.id);
        if (!updated) throw new Error('Updated water record was not found.');
        return updated;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'water_record');
      }
    },
    async deleteWater(id) {
      try {
        const result = await database.runAsync('DELETE FROM water_records WHERE id = ?', id);
        assertChanged(result.changes, 'water_record');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'water_record');
      }
    },
  };
}
