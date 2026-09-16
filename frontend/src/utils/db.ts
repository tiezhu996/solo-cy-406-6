import { openDB, IDBPDatabase } from 'idb';
import { replaceVariables } from '../hooks/useVariableReplace';
import { Clause } from '../types/clause';
import { ContractInstance } from '../types/contract-instance';
import { ContractStatus } from '../types/enums';
import { Template } from '../types/template';
import { Version } from '../types/version';

export const DB_NAME = 'contract-template-editor';
export const DB_VERSION = 1;

export const STORE_NAMES = ['templates', 'clauses', 'instances', 'versions'] as const;
export type StoreName = (typeof STORE_NAMES)[number];

export interface StoreValueMap {
  templates: Template;
  clauses: Clause;
  instances: ContractInstance;
  versions: Version;
}

export type StoreValue<S extends StoreName> = StoreValueMap[S];

export interface ExportPayload {
  templates: Template[];
  clauses: Clause[];
  instances: ContractInstance[];
  versions: Version[];
  exportedAt: string;
}

let dbPromise: Promise<IDBPDatabase> | undefined;

export function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const storeName of STORE_NAMES) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        }
      }
    });
  }

  return dbPromise;
}

export async function getAllRecords<S extends StoreName>(storeName: S): Promise<StoreValue<S>[]> {
  const db = await getDb();
  return (await db.getAll(storeName)) as StoreValue<S>[];
}

export async function getRecord<S extends StoreName>(storeName: S, id: string): Promise<StoreValue<S> | undefined> {
  const db = await getDb();
  return (await db.get(storeName, id)) as StoreValue<S> | undefined;
}

export async function putRecord<S extends StoreName>(storeName: S, record: StoreValue<S>) {
  const db = await getDb();
  await db.put(storeName, record);
  return record;
}

export async function deleteRecord(storeName: StoreName, id: string) {
  const db = await getDb();
  await db.delete(storeName, id);
}

/**
 * 把某个版本的变量和正文快照写回草稿实例。
 * 读取、校验、写入在同一个事务内完成：版本被删、实例已非草稿、
 * 或草稿在别处被改动（updatedAt 不一致）时整体中止，当前内容保持不变。
 * 模板在该版本保存后被改过（或已删除）时，标记 restoredVersionNo，
 * 编辑页据此展示版本原文，而不是按新模板重新生成的内容。
 */
export async function restoreInstanceToDraft(
  instanceId: string,
  versionId: string,
  expectedUpdatedAt: string
): Promise<ContractInstance> {
  const db = await getDb();
  const tx = db.transaction(['instances', 'versions', 'templates'], 'readwrite');
  const instanceStore = tx.objectStore('instances');
  const versionStore = tx.objectStore('versions');
  const templateStore = tx.objectStore('templates');

  try {
    const [instance, version] = (await Promise.all([instanceStore.get(instanceId), versionStore.get(versionId)])) as [
      ContractInstance | undefined,
      Version | undefined
    ];

    if (!instance) {
      throw new Error('合同实例不存在，本次恢复未生效');
    }
    if (!version || version.contractInstanceId !== instanceId) {
      throw new Error('所选版本不存在，本次恢复未生效');
    }
    if (instance.status !== ContractStatus.Draft) {
      throw new Error('仅草稿状态的合同可以恢复，本次恢复未生效');
    }
    if (instance.updatedAt !== expectedUpdatedAt) {
      throw new Error('草稿已在别处被修改，本次恢复未生效，请刷新后重试');
    }

    const template = (await templateStore.get(instance.templateId)) as Template | undefined;
    // 用当前模板对版本变量重新生成，与版本快照不一致即视为模板已变更
    const templateDiverged = replaceVariables(template, version.variableSnapshot) !== version.contentSnapshot;

    const restored: ContractInstance = {
      ...instance,
      variableValues: { ...version.variableSnapshot },
      finalHtml: version.contentSnapshot,
      restoredVersionNo: templateDiverged ? version.versionNo : undefined,
      updatedAt: nowIso()
    };

    await instanceStore.put(restored);
    await tx.done;
    return restored;
  } catch (error) {
    try {
      tx.abort();
      // 中止后 done 会以 AbortError 拒绝，在此吞掉，避免未处理的 rejection
      await tx.done;
    } catch {
      // 事务已结束或已中止，忽略
    }
    throw error;
  }
}

export async function clearStore(storeName: StoreName) {
  const db = await getDb();
  await db.clear(storeName);
}

export async function exportAllData(): Promise<ExportPayload> {
  const [templates, clauses, instances, versions] = await Promise.all([
    getAllRecords('templates'),
    getAllRecords('clauses'),
    getAllRecords('instances'),
    getAllRecords('versions')
  ]);

  return {
    templates,
    clauses,
    instances,
    versions,
    exportedAt: nowIso()
  };
}

export async function importAllData(payload: Partial<ExportPayload>) {
  const db = await getDb();
  const tx = db.transaction(STORE_NAMES, 'readwrite');

  for (const storeName of STORE_NAMES) {
    const store = tx.objectStore(storeName);
    await store.clear();
    const records = (payload[storeName] ?? []) as StoreValue<typeof storeName>[];
    for (const record of records) {
      await store.put(record);
    }
  }

  await tx.done;
}
