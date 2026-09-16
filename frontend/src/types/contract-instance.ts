import { ContractStatus } from './enums';

export type VariableValues = Record<string, string>;

export interface ContractInstance {
  id: string;
  templateId: string;
  title: string;
  variableValues: VariableValues;
  finalHtml: string;
  /**
   * 恢复历史版本时记录来源版本号：表示 finalHtml 是该版本保存时的快照，
   * 而非当前模板生成（模板在版本保存后已被修改）。基于当前模板重新保存后清除。
   */
  restoredVersionNo?: number;
  status: ContractStatus;
  versionIds: string[];
  createdAt: string;
  updatedAt: string;
}
