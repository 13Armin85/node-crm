import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AlertIcon, Box, Button, Heading, Text } from '@chakra-ui/react';
import { useFormik } from 'formik';
import { useParams } from 'react-router-dom';
import { FiEdit3, FiCheck, FiX } from 'react-icons/fi';
import { useLanguage } from 'i18n';
import { getApi } from 'services/api';
import { validateFormValues } from 'utils/managedForm';
import { formLabel } from 'utils/formValue';
import DynamicFormRenderer from 'components/dynamicForm/DynamicFormRenderer';
import FormFeedback from 'components/dynamicForm/FormFeedback';
import ConvertedLeadDetails from 'components/relations/ConvertedLeadDetails';
import NotesPanel from './NotesPanel';
import ContactToOpportunityButton from './ContactToOpportunityButton';
import RelatedRecordPanels from './RelatedRecordPanels';
import { RecordEditingContext, editableDefinition as getEditableDefinition, recordFormValues, changedRecordValues, saveRecordChanges } from './recordEditing';

function InlineEditor({ moduleName, record, definition, legacyModuleId, onCancel, onSaved }) {
  const { t } = useLanguage(), [error, setError] = useState('');
  const editableDefinition = getEditableDefinition(definition, record);
  const initialValues = recordFormValues(editableDefinition, record);
  const formik = useFormik({ initialValues, enableReinitialize: true,
    validate: values => validateFormValues(editableDefinition, values),
    async onSubmit(values, helpers) {
      setError(''); const payload = changedRecordValues(editableDefinition, values, initialValues);
      if (!Object.keys(payload).length) { onCancel(); return; }
      const result = await saveRecordChanges({ moduleName, record, legacyModuleId }, payload);
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
  const current = useRef(''); current.current = moduleName + '/' + id;
  const [workspace, setWorkspace] = useState(null), [error, setError] = useState(''), [editing, setEditing] = useState(false), [revision, setRevision] = useState(0), [saved, setSaved] = useState(false);
  const load = useCallback(async () => {
    const result = await getApi(`api/record-workspace/${encodeURIComponent(moduleName)}/${id}`);
    if (current.current !== moduleName + '/' + id) return;
    if (result?.status === 200) { setWorkspace(result.data); setError(''); return result.data; } else setError(result?.data?.code || 'serverError');
  }, [id, moduleName]);
  useEffect(() => { setWorkspace(null); setEditing(false); setSaved(false); load(); }, [load]);
  const onSaved = () => { setEditing(false); setSaved(true); setRevision(value => value + 1); load(); };
  const context = workspace && { ...workspace, moduleName, refresh: load, save: async changes => {
    const result = await saveRecordChanges({ moduleName, ...workspace }, changes);
    if (result?.status === 200) { await load(); setRevision(value => value + 1); setSaved(true); }
    return result;
  } };
  return <RecordEditingContext.Provider value={context}><Box className="crm-record-workspace" data-record-module={moduleName}>
    <header className="crm-detail-heading"><div><Text className="crm-detail-eyebrow">{t(moduleName)} · {t('Details')}</Text><Heading>{formLabel(workspace?.record) || formLabel(workspace?.record?.agenda || workspace?.record?.subject || workspace?.record?.templateName || workspace?.record?.recipient) || t(moduleName)}</Heading></div>
      <div className="crm-detail-heading-actions">{moduleName === 'Contacts' && <ContactToOpportunityButton contactId={id} />}
        {workspace?.editable && workspace.definition && <Button variant="outline" leftIcon={<FiEdit3 />} onClick={() => { setSaved(false); setEditing(value => !value); }}>{t(editing ? 'Cancel' : 'details.edit')}</Button>}
      </div></header>
    {error && <Alert status="error"><AlertIcon />{t(`estate.${error}`)}</Alert>}{saved && <Alert status="success"><AlertIcon />{t('Saved successfully')}</Alert>}
    {editing && workspace && <InlineEditor moduleName={moduleName} {...workspace} onCancel={() => setEditing(false)} onSaved={onSaved} />}
    <div className="crm-detail-legacy" key={`${moduleName}/${id}/${revision}`}>{children}</div>
    {moduleName === 'Opportunities' && <>
      <ConvertedLeadDetails records={workspace?.record?.convertedContacts} title={t('contactTransfer.original')} />
      <RelatedRecordPanels record={workspace?.record} />
    </>}
    {['Contacts', 'Opportunities'].includes(moduleName) && id && <NotesPanel key={id} moduleName={moduleName} recordId={id} />}
  </Box></RecordEditingContext.Provider>;
}
export const withRecordWorkspace = (Component, moduleName) => function WorkspaceView(props) { return <RecordWorkspace moduleName={moduleName}><Component {...props} /></RecordWorkspace>; };
