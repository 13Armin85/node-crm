import React, { useEffect, useMemo, useState } from 'react';
import { Alert, AlertIcon, Box, Button, Flex, FormLabel, Grid, GridItem, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, Spinner, Stack, Text } from '@chakra-ui/react';
import { FiUpload } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useLanguage } from 'i18n';
import { useFormDefinition } from 'utils/managedForm';
import { parseImportSpreadsheet } from 'utils/importSpreadsheet';
import { automaticMapping, importFields, importFieldLabel, importFieldPath, prepareImport } from 'utils/recordImport';
import { AsyncRelationSelect } from 'components/dynamicForm/DynamicFormRenderer';
import { postApi } from 'services/api';
import { LEAD_SELECTION_MESSAGE } from 'utils/leadRelations';

export const RECORDS_IMPORTED = 'crm:records-imported';

export default function RecordImportDialog({ moduleName, isOpen, onClose, onImported, initialFile, moduleId }) {
  const { t, language, direction } = useLanguage();
  const { definition, definitionError } = useFormDefinition(moduleName, isOpen);
  const [rows, setRows] = useState([]), [mapping, setMapping] = useState({}), [defaults, setDefaults] = useState({});
  const [busy, setBusy] = useState(false), [fileError, setFileError] = useState(''), [serverErrors, setServerErrors] = useState([]), [completed, setCompleted] = useState([]);
  const fields = useMemo(() => importFields(definition), [definition]);
  const headers = useMemo(() => [...new Set(rows.flatMap(row => Object.keys(row)))], [rows]);
  const prepared = useMemo(() => definition ? prepareImport(rows, definition, mapping, defaults, moduleName) : { records: [], errors: [] }, [rows, definition, mapping, defaults, moduleName]);
  const errors = [...prepared.errors, ...serverErrors].filter(error => !completed.includes(error.row));
  useEffect(() => { if (isOpen) { setRows([]); setMapping({}); setDefaults({}); setServerErrors([]); setFileError(''); setCompleted([]); } }, [isOpen, moduleName]);
  useEffect(() => { if (headers.length && fields.length) setMapping(automaticMapping(fields, headers)); }, [headers, fields]);
  const readFile = async file => {
    if (!file) return;
    setBusy(true); setFileError(''); setRows([]); setServerErrors([]); setCompleted([]);
    try { setRows(await parseImportSpreadsheet(file)); }
    catch { setFileError('Empty or invalid import file. Maximum 100 rows and 15 MB.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (isOpen && initialFile) readFile(initialFile); }, [initialFile, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const updateMapping = (path, value) => { setMapping(current => ({ ...current, [path]: value })); setServerErrors([]); };
  const submit = async () => {
    if (busy || prepared.errors.some(error => !completed.includes(error.row)) || !rows.length) return;
    setBusy(true); setFileError(''); setServerErrors([]);
    const indices = prepared.records.map((_, index) => index).filter(index => !completed.includes(index + 2));
    try {
      const result = await postApi(`api/import/${encodeURIComponent(moduleName)}`, { rows: indices.map(index => prepared.records[index]), sourceRows: indices.map(index => index + 2), ...(moduleId ? { moduleId } : {}) });
      const imported = result?.data?.importedRows || [];
      if (imported.length) setCompleted(current => [...new Set([...current, ...imported])]);
      if (result?.status >= 200 && result.status < 300) {
        toast.success(t('Imported successfully'));
        window.dispatchEvent(new CustomEvent(RECORDS_IMPORTED, { detail: { moduleName } }));
        onImported?.(); onClose();
      } else {
        setServerErrors(result?.data?.errors?.length ? result.data.errors : [{ code: result?.data?.code === 'duplicate' ? 'duplicate' : 'serverError', field: result?.data?.field }]);
        if (imported.length) { window.dispatchEvent(new CustomEvent(RECORDS_IMPORTED, { detail: { moduleName } })); onImported?.(); }
      }
    } catch { setServerErrors([{ code: 'serverError' }]); }
    finally { setBusy(false); }
  };
  const fieldName = path => {
    const field = fields.find(field => importFieldPath(field) === path);
    return field ? importFieldLabel(field, language) : path === 'leadRelations' ? t('Related To') : path || '';
  };
  return <Modal isOpen={isOpen} onClose={() => { if (!busy) onClose(); }} size="4xl" scrollBehavior="inside">
    <ModalOverlay /><ModalContent dir={direction} className="crm-import-modal">
      <ModalHeader>{t('Import')} · {t(moduleName)}</ModalHeader><ModalCloseButton isDisabled={busy} />
      <ModalBody>
        <Stack spacing={4}>
          <Text color="var(--crm-muted)" fontSize="sm">{t('Import CSV or Excel. Maximum 100 rows and 15 MB.')}</Text>
          <Box><FormLabel htmlFor="record-import-file">{t('Select File')}</FormLabel><Input id="record-import-file" type="file" accept=".csv,.xlsx" p={1} isDisabled={busy || completed.length > 0} onChange={event => readFile(event.target.files?.[0])} /></Box>
          {busy && <Flex gap={2} align="center"><Spinner size="sm" /><Text>{t('estate.loading')}</Text></Flex>}
          {(fileError || definitionError) && <Alert status="error"><AlertIcon />{t(fileError || 'estate.serverError')}</Alert>}
          {completed.length > 0 && <Alert status="success"><AlertIcon />{completed.length} {t('records imported')}</Alert>}
          {!!rows.length && definition && <>
            <Text fontWeight="700">{rows.length} {t('records')} · {t('Match file columns to CRM fields')}</Text>
            <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
              {fields.map(field => {
                const path = importFieldPath(field), fieldErrors = errors.filter(error => error.field === path);
                return <GridItem key={path}><FormLabel htmlFor={`import-map-${path}`} fontSize="sm">{importFieldLabel(field, language)}{field.required && <Box as="span" color="red.500" ms={1}>*</Box>}</FormLabel>
                  <Select id={`import-map-${path}`} aria-label={importFieldLabel(field, language)} value={mapping[path] || ''} isInvalid={fieldErrors.length > 0} isDisabled={busy || completed.length > 0} onChange={event => updateMapping(path, event.target.value)}>
                    <option value="">{t('Do not import this column')}</option>{headers.map(header => <option value={header} key={header}>{header}</option>)}
                  </Select>
                  {!mapping[path] && field.relation && <Box mt={2}><Text mb={1} fontSize="xs">{t('Default for all rows')}</Text><AsyncRelationSelect id={`import-default-${path}`} name={path} moduleName={field.relation} value={defaults[path] || ''} disabled={busy} onChange={value => { setDefaults(current => ({ ...current, [path]: value })); setServerErrors([]); }} /></Box>}
                </GridItem>;
              })}
            </Grid>
            <Box className="crm-import-preview" overflowX="auto" borderWidth="1px" borderRadius="lg" p={3}>
              <Text fontWeight="700" mb={2}>{t('Preview')}</Text>
              <table><thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.slice(0, 5).map((row, index) => <tr key={index}>{headers.map(header => <td key={header}>{row[header] instanceof Date ? row[header].toISOString().slice(0, 10) : String(row[header] ?? '')}</td>)}</tr>)}</tbody></table>
            </Box>
          </>}
          {!!errors.length && <Alert status="error" alignItems="flex-start"><AlertIcon /><Box role="alert">{errors.slice(0, 20).map((error, index) => <Text fontSize="sm" key={index}>{error.row ? `${t('Row')} ${error.row}: ` : ''}{fieldName(error.field)} {t(error.code === 'leadSelectionRequired' ? LEAD_SELECTION_MESSAGE : `estate.${error.code || 'invalid'}`)}</Text>)}{errors.length > 20 && <Text>+{errors.length - 20}</Text>}</Box></Alert>}
        </Stack>
      </ModalBody>
      <ModalFooter gap={2}><Button variant="brand" leftIcon={<FiUpload />} isLoading={busy} isDisabled={!definition || !rows.length || prepared.errors.some(error => !completed.includes(error.row)) || completed.length === rows.length} onClick={submit}>{t('Import')}</Button><Button variant="outline" isDisabled={busy} onClick={onClose}>{t('Close')}</Button></ModalFooter>
    </ModalContent>
  </Modal>;
}
