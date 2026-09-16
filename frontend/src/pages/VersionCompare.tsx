import { Alert, Button, Message, Space, Typography } from '@arco-design/web-react';
import { IconLeft } from '@arco-design/web-react/icon';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { VersionDiff, VersionSelector } from '../components/common';
import { useInstanceStore } from '../stores/instance';
import { useVersionStore } from '../stores/version';
import { ContractStatus, CONTRACT_STATUS_LABELS } from '../types/enums';
import { Version } from '../types/version';

export function VersionCompare() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [leftId, setLeftId] = useState<string | undefined>();
  const [rightId, setRightId] = useState<string | undefined>();
  const [restoring, setRestoring] = useState(false);
  const { instances, loadInstances, restoreFromVersion } = useInstanceStore();
  const { versions, loadVersions } = useVersionStore();

  useEffect(() => {
    void Promise.all([loadInstances(), loadVersions()]);
  }, [loadInstances, loadVersions]);

  const instance = useMemo(() => instances.find((item) => item.id === id), [id, instances]);
  const relatedVersions = useMemo(
    () =>
      versions
        .filter((version) => version.contractInstanceId === id)
        .sort((a, b) => a.versionNo - b.versionNo),
    [id, versions]
  );

  useEffect(() => {
    if (relatedVersions.length && !leftId && !rightId) {
      setLeftId(relatedVersions[Math.max(0, relatedVersions.length - 2)]?.id);
      setRightId(relatedVersions[relatedVersions.length - 1]?.id);
    }
  }, [leftId, relatedVersions, rightId]);

  const left = relatedVersions.find((version) => version.id === leftId);
  const right = relatedVersions.find((version) => version.id === rightId);

  const canRestore = instance?.status === ContractStatus.Draft;
  const restoreHint = instance
    ? `当前合同状态为「${CONTRACT_STATUS_LABELS[instance.status]}」，仅草稿状态可恢复版本`
    : undefined;

  const handleRestore = async (version: Version) => {
    if (!instance || restoring) {
      return;
    }

    setRestoring(true);
    try {
      const restored = await restoreFromVersion(version);
      Message.success(
        restored.restoredVersionNo != null
          ? `已将版本 ${version.versionNo} 恢复到草稿；模板已有更新，编辑页将显示该版保存时的正文`
          : `已将版本 ${version.versionNo} 的变量和正文恢复到草稿`
      );
      navigate(`/instances/${instance.id}`);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '恢复失败，当前草稿内容未变更');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <Typography.Title heading={3}>版本对比</Typography.Title>
          <Typography.Text type="secondary">{instance?.title ?? '合同实例'} 的版本历史。</Typography.Text>
        </div>
        <Space>
          {instance && (
            <Button icon={<IconLeft />} onClick={() => navigate(`/instances/${instance.id}`)}>
              返回实例
            </Button>
          )}
        </Space>
      </div>

      {instance && !canRestore && (
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          content={`当前合同状态为「${CONTRACT_STATUS_LABELS[instance.status]}」，版本内容只读，不能恢复到草稿。`}
        />
      )}

      <VersionSelector versions={relatedVersions} leftId={leftId} rightId={rightId} onLeftChange={setLeftId} onRightChange={setRightId} />
      <VersionDiff
        left={left}
        right={right}
        canRestore={canRestore && !restoring}
        restoreHint={restoreHint}
        onRestore={instance ? (version) => void handleRestore(version) : undefined}
      />

      {!relatedVersions.length && <div className="empty-state">当前实例还没有版本，请先在实例编辑页保存版本。</div>}
    </section>
  );
}
