import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AlertIcon, Box, Button, Heading, Text } from '@chakra-ui/react';
import { getIn, setIn, useFormik } from 'formik';
import { useParams } from 'react-router-dom';
import { FiEdit3, FiCheck, FiX } from 'react-icons/fi';
import { useLanguage } from 'i18n';
import { getApi, putApi } from 'services/api';
import { normalizeFormValues, validateFormValues } from 'utils/managedForm';
import { formLabel } from 'utils/formValue';
import DynamicFormRenderer, { fieldPath } from 'components/dynamicForm/DynamicFormRenderer';
import FormFeedback from 'components/dynamicForm/FormFeedback';
import ConvertedLeadDetails from 'components/relations/ConvertedLeadDetails';
import NotesPanel from './NotesPanel';
import ContactToOpportunityButton from './ContactToOpportunityButton';
import RelatedRecordPanels from './RelatedRecordPanels';

const paths = { Tasks: 'task', Meetings: 'meeting', Opportunities: 'opportunity', Invoices: 'invoices', Quotes: 'quotes', Users: 'user', 'Email Template': 'email-temp', 'Bank Details': 'bank-details', 'Opportunity Project': 'opportunityproject' };
function InlineEditor({ moduleName, record, definition, legacyModuleId, onCancel, onSaved }) {
  const { t } = useLanguage(), [error, setError] = useState('');
  const editableDefinition = { ...definition, fields: (definition?.fields || []).filter(field => !field.external && !['password', 'role', 'createBy', 'modifiedBy', 'createdDate', 'updatedDate', 'deleted', 'authVersion', 'avatarFilename'].includes(field.name)
    && (getIn(record, fieldPath(field)) == null || typeof getIn(record, fieldPath(field)) !== 'object' || field.relation || field.type === 'file')) };
  const formik = useFormik({ initialValues: record, enableReinitialize: true,
    validate: values => validateFormValues(editableDefinition, values),
    async onSubmit(values, helpers) {
      setError(''); const normalized = normalizeFormValues(editableDefinition, values), original = normalizeFormValues(editableDefinition, record);
      let payload = {};
      for (const field of editableDefinition.fields) {
        const path = fieldPath(field), value = getIn(normalized, path);
        if (JSON.stringify(value) !== JSON.stringify(getIn(original, path))) payload = setIn(payload, path, value);
      }
      if (!Object.keys(payload).length) { onCancel(); return; }
      const estate = ['Properties', 'Residences', 'Partner Customers'].includes(moduleName);
      const activity = ['Calls', 'Emails'].includes(moduleName);
      const generic = !paths[moduleName] && !estate && !activity;
      if (generic) payload.moduleId = legacyModuleId;
      const result = await putApi(activity ? `api/record-workspace/${moduleName}/${record._id}` : estate ? `api/estate/${encodeURIComponent(moduleName)}/${record._id}` : generic ? `api/form/edit/${record._id}` : `api/${paths[moduleName]}/edit/${record._id}`, payload);
      if (result?.status === 200) onSaved();
      else { setError(result?.data?.code || 'serverError'); if (result?.data?.field) helpers.setFieldError(result.data.field, result.data.code || 'invalid'); }
    },
  });
  return <section className="crm-detail-surface crm-inline-record-editor">
    <header className="crm-detail-section-heading"><Heading size="sm">{t('details.edit')}</Heading><Text>{t('details.editHint')}</Text></header>
    {error && <Alert status="error"><AlertIcon />{t(`estate.${error}`)}</Alert>}<FormFeedback formik={formik} />
    <DynamicFormRenderer definition={editableDefinition} formik={formik} idPrefix="detail-edit" />
    <div className="crm-inline-editor-actions"><Button variant="outline" leftIcon={<FiX />} onClick={onCancel} isDisabled={formik.isSubmitting}>{t('Cancel')}</Button><Button variant="brand" leftIcon={<FiCheck />} onClick={formik.handleSubmit} isLoading={formik.isSubmitting}>{t('Save')}</Button></div>
  </section>;
}

export default function RecordWorkspace({ moduleName, children, recordId }) {
  const params = useParams(), id = recordId || params.id;
  const { t } = useLanguage();
  const [workspace, setWorkspace] = useState(null), [error, setError] = useState(''), [editing, setEditing] = useState(false), [revision, setRevision] = useState(0), [saved, setSaved] = useState(false);
  const load = useCallback(async () => {
    const result = await getApi(`api/record-workspace/${encodeURIComponent(moduleName)}/${id}`);
    if (result?.status === 200) { setWorkspace(result.data); setError(''); } else setError(result?.data?.code || 'serverError');
  }, [id, moduleName]);
  useEffect(() => { setWorkspace(null); setEditing(false); setSaved(false); load(); }, [load]);
  const onSaved = () => { setEditing(false); setSaved(true); setRevision(value => value + 1); load(); };
  return <Box className="crm-record-workspace" data-record-module={moduleName}>
    <header className="crm-detail-heading"><div><Text className="crm-detail-eyebrow">{t(moduleName)} · {t('Details')}</Text><Heading>{formLabel(workspace?.record) || formLabel(workspace?.record?.agenda || workspace?.record?.subject || workspace?.record?.templateName || workspace?.record?.recipient) || t(moduleName)}</Heading></div>
      <div className="crm-detail-heading-actions">{moduleName === 'Contacts' && <ContactToOpportunityButton contactId={id} />}
        {workspace?.editable && workspace.definition && <Button variant="outline" leftIcon={<FiEdit3 />} onClick={() => { setSaved(false); setEditing(value => !value); }}>{t(editing ? 'Cancel' : 'details.edit')}</Button>}
      </div></header>
    {error && <Alert status="error"><AlertIcon />{t(`estate.${error}`)}</Alert>}{saved && <Alert status="success"><AlertIcon />{t('Saved successfully')}</Alert>}
    {editing && workspace && <InlineEditor moduleName={moduleName} {...workspace} onCancel={() => setEditing(false)} onSaved={onSaved} />}
    <div className="crm-detail-legacy" key={revision}>{children}</div>
    {moduleName === 'Opportunities' && <>
      <ConvertedLeadDetails records={workspace?.record?.convertedContacts} title={t('contactTransfer.original')} />
      <RelatedRecordPanels record={workspace?.record} />
    </>}
    {['Contacts', 'Opportunities'].includes(moduleName) && id && <NotesPanel key={id} moduleName={moduleName} recordId={id} />}
  </Box>;
}
export const withRecordWorkspace = (Component, moduleName) => function WorkspaceView(props) { return <RecordWorkspace moduleName={moduleName}><Component {...props} /></RecordWorkspace>; };
