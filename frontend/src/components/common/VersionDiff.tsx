import { Button, Card, Popconfirm, Tooltip, Typography } from '@arco-design/web-react';
import { useMemo } from 'react';
import { Version } from '../../types/version';
import { buildSideBySideDiff, DiffToken } from '../../utils/diff';

interface VersionDiffProps {
  left?: Version;
  right?: Version;
  canRestore?: boolean;
  restoreHint?: string;
  onRestore?: (version: Version) => void;
}

interface DiffColumnProps {
  title: string;
  tokens: DiffToken[];
  version: Version;
  canRestore: boolean;
  restoreHint?: string;
  onRestore?: (version: Version) => void;
}

function DiffColumn({ title, tokens, version, canRestore, restoreHint, onRestore }: DiffColumnProps) {
  const restoreButton = (
    <Button size="mini" type="outline" disabled={!canRestore}>
      恢复到草稿
    </Button>
  );

  const extra = onRestore ? (
    canRestore ? (
      <Popconfirm
        title={`将版本 ${version.versionNo} 的变量和正文写回当前草稿？`}
        content="当前草稿内容会被覆盖，已有版本记录和编号保持不变。"
        okText="恢复"
        cancelText="取消"
        onOk={() => onRestore(version)}
      >
        {restoreButton}
      </Popconfirm>
    ) : (
      <Tooltip content={restoreHint ?? '当前状态不可恢复'}>
        <span>{restoreButton}</span>
      </Tooltip>
    )
  ) : null;

  return (
    <Card className="diff-column" title={title} extra={extra}>
      <div className="diff-text">
        {tokens.map((token, index) => (
          <span key={`${token.value}-${index}`} className={token.added ? 'diff-added' : token.removed ? 'diff-removed' : undefined}>
            {token.value}
          </span>
        ))}
      </div>
    </Card>
  );
}

export function VersionDiff({ left, right, canRestore = false, restoreHint, onRestore }: VersionDiffProps) {
  const diff = useMemo(() => buildSideBySideDiff(left?.contentSnapshot ?? '', right?.contentSnapshot ?? ''), [left, right]);

  if (!left || !right) {
    return <div className="empty-state">请选择两个版本查看差异。</div>;
  }

  return (
    <div className="version-diff">
      <div className="diff-header">
        <Typography.Text type="secondary">左侧红色表示被删除内容，右侧绿色表示新增内容。</Typography.Text>
      </div>
      <div className="diff-grid">
        <DiffColumn
          title={`版本 ${left.versionNo} · ${left.remark}`}
          tokens={diff.left}
          version={left}
          canRestore={canRestore}
          restoreHint={restoreHint}
          onRestore={onRestore}
        />
        <DiffColumn
          title={`版本 ${right.versionNo} · ${right.remark}`}
          tokens={diff.right}
          version={right}
          canRestore={canRestore}
          restoreHint={restoreHint}
          onRestore={onRestore}
        />
      </div>
    </div>
  );
}
