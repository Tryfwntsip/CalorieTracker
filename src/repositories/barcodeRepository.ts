import type { Database } from '@/db/types';
import { barcodeScanHistorySchema, scannedProductSchema } from '@/schemas';
import type {
  BarcodeScanHistory,
  BarcodeScanHistoryWrite,
  ScannedProduct,
  ScannedProductWrite,
} from '@/types';
import { assertChanged, mapRepositoryError, parseRecord } from '@/repositories/errors';
import { encodeJson, systemClock, type Clock } from '@/repositories/shared';

const selectProduct = `
SELECT barcode, food_id AS foodId, source, raw_payload_json AS rawPayload,
  fetched_at AS fetchedAt, created_at AS createdAt, updated_at AS updatedAt
FROM scanned_products
`;

const selectHistory = `
SELECT id, barcode, status, resolved_food_id AS resolvedFoodId, scanned_at AS scannedAt
FROM barcode_scan_history
`;

export interface BarcodeRepository {
  getProduct(barcode: string): Promise<ScannedProduct | null>;
  createProduct(product: ScannedProductWrite): Promise<ScannedProduct>;
  updateProduct(product: ScannedProductWrite): Promise<ScannedProduct>;
  deleteProduct(barcode: string): Promise<void>;
  getHistory(id: string): Promise<BarcodeScanHistory | null>;
  listHistory(): Promise<BarcodeScanHistory[]>;
  createHistory(entry: BarcodeScanHistoryWrite): Promise<BarcodeScanHistory>;
  updateHistory(entry: BarcodeScanHistoryWrite): Promise<BarcodeScanHistory>;
  deleteHistory(id: string): Promise<void>;
}

export function createBarcodeRepository(
  database: Database,
  clock: Clock = systemClock,
): BarcodeRepository {
  const getProduct = async (barcode: string): Promise<ScannedProduct | null> => {
    try {
      const row = await database.getFirstAsync<unknown>(
        `${selectProduct} WHERE barcode = ?`,
        barcode,
      );
      return row === null ? null : parseRecord(scannedProductSchema, row, 'scanned_product');
    } catch (error: unknown) {
      throw mapRepositoryError(error, 'scanned_product');
    }
  };

  const getHistory = async (id: string): Promise<BarcodeScanHistory | null> => {
    try {
      const row = await database.getFirstAsync<unknown>(`${selectHistory} WHERE id = ?`, id);
      return row === null
        ? null
        : parseRecord(barcodeScanHistorySchema, row, 'barcode_scan_history');
    } catch (error: unknown) {
      throw mapRepositoryError(error, 'barcode_scan_history');
    }
  };

  return {
    getProduct,
    async createProduct(product) {
      try {
        const now = clock.now();
        await database.runAsync(
          `INSERT INTO scanned_products (
            barcode, food_id, source, raw_payload_json, fetched_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          product.barcode,
          product.foodId,
          product.source,
          encodeJson(product.rawPayload),
          product.fetchedAt,
          now,
          now,
        );
        const created = await getProduct(product.barcode);
        if (!created) throw new Error('Inserted scanned product was not found.');
        return created;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'scanned_product');
      }
    },
    async updateProduct(product) {
      try {
        const result = await database.runAsync(
          `UPDATE scanned_products SET food_id = ?, source = ?, raw_payload_json = ?,
            fetched_at = ?, updated_at = ? WHERE barcode = ?`,
          product.foodId,
          product.source,
          encodeJson(product.rawPayload),
          product.fetchedAt,
          clock.now(),
          product.barcode,
        );
        assertChanged(result.changes, 'scanned_product');
        const updated = await getProduct(product.barcode);
        if (!updated) throw new Error('Updated scanned product was not found.');
        return updated;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'scanned_product');
      }
    },
    async deleteProduct(barcode) {
      try {
        const result = await database.runAsync(
          'DELETE FROM scanned_products WHERE barcode = ?',
          barcode,
        );
        assertChanged(result.changes, 'scanned_product');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'scanned_product');
      }
    },
    getHistory,
    async listHistory() {
      try {
        const rows = await database.getAllAsync<unknown>(
          `${selectHistory} ORDER BY scanned_at DESC, id`,
        );
        return rows.map((row) =>
          parseRecord(barcodeScanHistorySchema, row, 'barcode_scan_history'),
        );
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'barcode_scan_history');
      }
    },
    async createHistory(entry) {
      try {
        await database.runAsync(
          `INSERT INTO barcode_scan_history (
            id, barcode, status, resolved_food_id, scanned_at
          ) VALUES (?, ?, ?, ?, ?)`,
          entry.id,
          entry.barcode,
          entry.status,
          entry.resolvedFoodId,
          entry.scannedAt,
        );
        const created = await getHistory(entry.id);
        if (!created) throw new Error('Inserted scan history was not found.');
        return created;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'barcode_scan_history');
      }
    },
    async updateHistory(entry) {
      try {
        const result = await database.runAsync(
          `UPDATE barcode_scan_history
           SET barcode = ?, status = ?, resolved_food_id = ?, scanned_at = ?
           WHERE id = ?`,
          entry.barcode,
          entry.status,
          entry.resolvedFoodId,
          entry.scannedAt,
          entry.id,
        );
        assertChanged(result.changes, 'barcode_scan_history');
        const updated = await getHistory(entry.id);
        if (!updated) throw new Error('Updated scan history was not found.');
        return updated;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'barcode_scan_history');
      }
    },
    async deleteHistory(id) {
      try {
        const result = await database.runAsync('DELETE FROM barcode_scan_history WHERE id = ?', id);
        assertChanged(result.changes, 'barcode_scan_history');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'barcode_scan_history');
      }
    },
  };
}
