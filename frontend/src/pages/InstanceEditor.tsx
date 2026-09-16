import { Alert, Button, Input, Message, Select, Space, Typography } from '@arco-design/web-react';
import { IconHistory, IconSave } from '@arco-design/web-react/icon';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { VariableForm } from '../components/common';
import { ContractPreview } from '../components/preview/ContractPreview';
import { useVariableReplace } from '../hooks/useVariableReplace';
import { useInstanceStore } from '../stores/instance';
import { useTemplateStore } from '../stores/template';
import { useVersionStore } from '../stores/version';
import { ContractStatus, CONTRACT_STATUS_LABELS } from '../types/enums';
import { VariableValues } from '../types/contract-instance';

const statusOptions = Object.values(ContractStatus).map((value) => ({
  label: CONTRACT_STATUS_LABELS[value],
  value
}));

function sameVariableValues(a: VariableValues, b: VariableValues) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((key) => a[key] === b[key]);
}

export function InstanceEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [values, setValues] = useState<VariableValues>({});
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState(ContractStatus.Draft);
  const [remark, setRemark] = useState('');
  const { instances, loadInstances, updateInstance } = useInstanceStore();
  const { templates, loadTemplates } = useTemplateStore();
  const { loadVersions, saveVersion } = useVersionStore();

  useEffect(() => {
    void Promise.all([loadInstances(), loadTemplates(), loadVersions()]);
  }, [loadInstances, loadTemplates, loadVersions]);

  const instance = useMemo(() => instances.find((item) => item.id === id), [id, instances]);
  const template = useMemo(() => templates.find((item) => item.id === instance?.templateId), [instance?.templateId, templates]);
  const livePreviewHtml = useVariableReplace(template, values);

  useEffect(() => {
    if (instance) {
      setValues(instance.variableValues);
      setTitle(instance.title);
      setStatus(instance.status);
    }
  }, [instance]);

  if (!instance || !template) {
    return <div className="empty-state">正在加载合同实例...</div>;
  }

  // 恢复到历史版本且模板已变更时，变量未被改动前展示该版保存时的正文，
  // 而不是按新模板重新生成的内容；一旦修改变量则切换为当前模板的实时预览。
  const restoredVersionNo = instance.restoredVersionNo;
  const valuesDirty = !sameVariableValues(values, instance.variableValues);
  const showRestoredSnapshot = restoredVersionNo != null && !valuesDirty;
  const previewHtml = showRestoredSnapshot ? instance.finalHtml : livePreviewHtml;

  const buildNextInstance = () => ({
    ...instance,
    title: title || instance.title,
    variableValues: values,
    finalHtml: previewHtml,
    status,
    // 仍展示历史快照的保存保留恢复标记；内容已基于当前模板重新生成时清除
    restoredVersionNo: showRestoredSnapshot ? restoredVersionNo : undefined
  });

  const saveInstance = async () => {
    await updateInstance(buildNextInstance());
    Message.success('合同实例已保存');
  };

  const saveSnapshot = async () => {
    const nextInstance = buildNextInstance();
    await updateInstance(nextInstance);
    const version = await saveVersion(nextInstance, remark);
    await updateInstance({
      ...nextInstance,
      versionIds: Array.from(new Set([...nextInstance.versionIds, version.id]))
    });
    setRemark('');
    Message.success(`已保存版本 ${version.versionNo}`);
  };

  return (
    <section className="page-section instance-page">
      <div className="page-heading">
        <div>
          <Typography.Title heading={3}>合同实例编辑</Typography.Title>
          <Typography.Text type="secondary">填写变量后实时生成最终合同 HTML。</Typography.Text>
        </div>
        <Space wrap>
          <Button icon={<IconHistory />} onClick={() => navigate(`/instances/${instance.id}/versions`)}>
            版本对比
          </Button>
          <Button icon={<IconSave />} onClick={() => void saveInstance()}>
            保存实例
          </Button>
          <Button type="primary" onClick={() => void saveSnapshot()}>
            保存版本
          </Button>
        </Space>
      </div>

      <div className="instance-meta-bar">
        <Input value={title} onChange={setTitle} placeholder="实例标题" />
        <Select value={status} options={statusOptions} onChange={setStatus} />
        <Input value={remark} onChange={setRemark} placeholder="版本备注，例如：客户首轮修改" />
      </div>

      {restoredVersionNo != null && (
        <Alert
          style={{ marginBottom: 16 }}
          type="info"
          content={
            showRestoredSnapshot
              ? `当前显示版本 ${restoredVersionNo} 保存时的正文；模板在此之后已有更新，修改变量后将基于当前模板重新生成。`
              : `模板已有更新，当前预览基于最新模板，与版本 ${restoredVersionNo} 保存时的正文不同；重新保存前历史版本内容保持不变。`
          }
        />
      )}

      <div className="instance-grid">
        <ContractPreview
          title={title || instance.title}
          html={previewHtml}
          hint={showRestoredSnapshot ? `版本 ${restoredVersionNo} 保存时的正文` : undefined}
        />
        <div className="form-panel">
          <Typography.Title heading={5}>变量填写</Typography.Title>
          <VariableForm variables={template.variables} values={values} onChange={setValues} />
        </div>
      </div>
    </section>
  );
}
