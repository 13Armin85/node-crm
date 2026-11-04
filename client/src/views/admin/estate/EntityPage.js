import { tableFields, TableFieldValue, tableFieldValue, prepareTableExport } from 'components/table/FormTableFields';
import RecordPagination from "components/pagination/RecordPagination";
import TableTools, { useVisibleColumns } from 'components/table/TableTools';
import RecordImportDialog from 'components/table/RecordImportDialog';
import { exportSpreadsheet } from 'utils/spreadsheet';
import FormFeedback from 'components/dynamicForm/FormFeedback';
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert, AlertIcon, Box, Button, Flex, Grid, GridItem, Heading, Icon, IconButton, Input,
  InputGroup, InputLeftElement, Modal, ModalBody, ModalCloseButton,
  ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, SimpleGrid,
  Spinner, Stack, Table, Tbody, Td, Text, Th, Thead, Tooltip, Tr,
} from "@chakra-ui/react";
import { useFormik, getIn, setIn } from "formik";
import { useParams } from "react-router-dom";
import {
  FiEdit3, FiEye, FiFilter, FiHome,
  FiPlus, FiSearch, FiTrash2, FiUsers, FiX,
} from "react-icons/fi";
import Card from "components/card/Card";
import DynamicFormRenderer, { fieldPath, localized } from "components/dynamicForm/DynamicFormRenderer";
import { useLanguage } from "i18n";
import { getApi, postApi, putApi, deleteApi } from "services/api";
import { HasAccess } from "../../../redux/accessUtils";
import { useFormDefinition, validateFormValues } from "utils/managedForm";
import ShareRecordButton from "components/ShareRecordButton";
import SharedRecordBadge from "components/SharedRecordBadge";
import PropertyStatusBadge from "components/PropertyStatusBadge";
import { entityExportColumns, loadAllExportRows } from "utils/exportRecords";
import PropertyOwnerField from './PropertyOwnerField';
import { normalizeFormValues } from 'utils/managedForm';
import { formLabel } from 'utils/formValue';
import RecordValue from 'components/relations/RecordValue';
import CatalogRecordDialog from './CatalogRecordDialog';
import RecordFields from 'components/record/RecordFields';
import { RecordEditingContext, useRecordEditing, saveRecordChanges } from 'components/record/recordEditing';

export function EntityPage({ moduleName }) {
  const outerEditing = useRecordEditing();
  const { t, language, direction } = useLanguage();
  const [permissions] = HasAccess([moduleName]);
  const [districtPermissions, residencePermissions] = HasAccess(['Districts', 'Residences']);
  const [creatingRelated, setCreatingRelated] = useState(null);
  const [relatedVersion, setRelatedVersion] = useState(0);
  const { id } = useParams();
  const { definition, definitionError } = useFormDefinition(moduleName);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState("createdDate");
  const [order, setOrder] = useState("desc");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusSaving, setStatusSaving] = useState(null);
  const [record, setRecord] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const base = `api/estate/${encodeURIComponent(moduleName)}`;

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(query); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchData = useCallback(async () => {
    setBusy(true);
    setError("");
    const params = new URLSearchParams({ q: search, page, limit: pageSize, sort, order, ...filters });
    const result = await getApi(`${base}?${params}`);
    if (result.status === 200) {
      setItems(result.data.items);
      setTotal(result.data.total);
    } else setError(result.data?.code || "serverError");
    setBusy(false);
  }, [base, search, page, pageSize, sort, order, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    let active = true;
    if (id) {
      getApi(`${base}/${id}`).then((result) => {
        if (!active) return;
        if (result.status === 200) { setRecord(result.data); setReadOnly(true); }
        else setError(result.data?.code || "serverError");
      });
    }
    return () => { active = false; };
  }, [base, id]);

  useEffect(() => { if (definitionError) setError('serverError'); }, [definitionError]);

  let initialValues = record || {};
  if (definition) {
    for (const field of definition.fields) {
      if (getIn(initialValues, fieldPath(field)) === undefined && field.defaultValue !== undefined) {
        initialValues = setIn(initialValues, fieldPath(field), field.defaultValue);
      }
    }
  }
  initialValues = normalizeFormValues(definition, initialValues);

  const formik = useFormik({
    initialValues,
    enableReinitialize: true,
    validate: values => validateFormValues(definition, values),
    async onSubmit(values, helpers) {
      setError("");
      const payload = normalizeFormValues(definition, values);
      const response = record?._id ? await putApi(`${base}/${record._id}`, payload) : await postApi(base, payload);
      const result = response?.response || response;
      if ([200, 201].includes(result.status)) {
        setRecord(null);
        setNotice("Success");
        await fetchData();
      } else {
        setError(result.data?.code || "serverError");
        if (result.data?.field) helpers.setFieldError(result.data.field, result.data.code);
      }
    },
  });

  const open = (item, view) => { setError(""); setRecord(item); setReadOnly(view); };
  const filterNames = moduleName === "Properties"
    ? ["category", "subtype", "transactionType", "district", "neighborhood", "residence", "bedroom", "buildingAge", "occupancyStatus", "floor", "area.type", "sale.status"]
    : moduleName === "Partner Customers" ? ["customerType", "status", "district"] : ["category", "transactionType", "city", "district", "neighborhood", "constructionStatus", "occupancyStatus", "sale.status"];
  const name = (item) => formLabel(item) || t('Record unavailable');
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const PageIcon = ["Properties", "Residences"].includes(moduleName) ? FiHome : FiUsers;

  const remove = async () => {
    const result = await deleteApi(`${base}/`, deleting._id);
    if (result.status === 200) { setDeleting(null); setNotice("Success"); fetchData(); }
    else { setError(result.data?.code || "serverError"); setDeleting(null); }
  };

  const partnerStatusField = definition?.fields.find(field => field.name === 'status');
  const updatePartnerStatus = async (item, status) => {
    if (!permissions?.update || statusSaving || status === item.status) return;
    setStatusSaving(item._id); setError(''); setNotice('');
    try {
      const response = await putApi(`${base}/${item._id}`, { status });
      const result = response?.response || response;
      if (result?.status === 200) { setNotice('Success'); await fetchData(); }
      else setError(result?.data?.code || 'serverError');
    } catch { setError('serverError'); }
    finally { setStatusSaving(null); }
  };
  const form = definition ? <DynamicFormRenderer definition={definition} formik={formik} readOnly={readOnly} refreshKey={relatedVersion}
    fieldControls={moduleName === 'Properties' ? { propertyOwner: field => <PropertyOwnerField field={field} formik={formik} readOnly={readOnly} /> } : {}}
    fieldActions={{
      ...(districtPermissions?.create ? { district: <Button size="sm" variant="outline" mt={2} leftIcon={<FiPlus />} onClick={() => setCreatingRelated('Districts')}>{t('Create New District')}</Button> } : {}),
      ...(moduleName === 'Properties' && residencePermissions?.create ? { residence: <Button size="sm" variant="outline" mt={2} leftIcon={<FiPlus />} onClick={() => setCreatingRelated('Residences')}>{t('Create New Residence')}</Button> } : {}),
    }} /> : <Spinner />;
  const detailEditing = record?._id && { moduleName, definition, record, editable: Boolean(permissions?.update), save: async changes => {
    const result = await saveRecordChanges({ moduleName, record }, changes);
    if (result?.status === 200) { setRecord(result.data); await fetchData(); await outerEditing?.refresh?.(); }
    return result;
  } };

  const fields = tableFields(definition);
  const primaryName = moduleName === 'Properties' ? 'title' : moduleName === 'Residences' ? 'name' : 'fullName';
  const tableColumns = [
    ...(moduleName === 'Properties' ? [{id:'number',label:t('estate.rowNumber')}] : []),
    ...fields.map(field=>({id:fieldPath(field),label:localized(field.label,language)||field.name,field})),
    ...(!fields.some(field=>field.name==='createdDate')?[{id:'createdDate',label:t('Created Date'),field:{name:'createdDate',type:'date'}}]:[]),
    {id:'actions',label:t('Actions')},
  ];
  const {visible,order:columnOrder,orderedColumns,setVisible}=useVisibleColumns(tableColumns,moduleName);
  const hiddenColumnStyles={};
  const download = async extension => {
    setExporting(true);
    try {
      const rows = await loadAllExportRows(getApi, base, { q: search, sort, order, ...filters });
      const exportFields = new Map(entityExportColumns(definition, language, t).map(column => [column.accessor, column]));
      const exportColumns = columnOrder.filter(id => visible.includes(id)).map(id => exportFields.get(id)).filter(Boolean);
      await exportSpreadsheet({ jsonArray: rows, csvColumns: await prepareTableExport(exportColumns,rows,t,language), fileName: t(moduleName), extension, rightToLeft: language === 'fa' });
    } catch { setError('serverError'); }
    finally { setExporting(false); }
  };

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  return (
    <Box className="crm-entity-page" dir={direction}>
      <Flex className="crm-page-hero" align={{ base: "flex-start", md: "center" }} justify="space-between" direction={{ base: "column", md: "row" }} gap="18px">
        <Flex align="center" gap="14px">
          <Flex className="crm-page-hero__icon" align="center" justify="center"><Icon as={PageIcon} /></Flex>
          <Box>
            <Flex align="center" gap="9px" wrap="wrap">
              <Heading className="crm-page-hero__title">{t(moduleName)}</Heading>
              <Box className="crm-page-hero__count">{total} {t("records")}</Box>
            </Flex>
            <Text className="crm-page-hero__subtitle">{t("Manage business records from one place")}</Text>
          </Box>
        </Flex>
        <Flex gap={2} wrap="wrap">
          {permissions?.create && <Button className="crm-page-hero__action" leftIcon={<FiPlus />} onClick={() => open({}, false)}>{t("Add New")}</Button>}
        </Flex>
      </Flex>

      {error && <Alert status="error" className="crm-page-alert"><AlertIcon />{t(`estate.${error}`)}</Alert>}
      {notice && <Alert status="success" className="crm-page-alert"><AlertIcon />{t(notice)}</Alert>}

      <Card className="crm-entity-card crm-data-card crm-list-table">
        <Grid className="crm-table-toolbar" templateColumns="repeat(12, 1fr)" gap={3}>
          <GridItem colSpan={{ base: 12, lg: 10 }} display="flex" alignItems="center">
            <Flex className="crm-table-toolbar__main" alignItems="center" flexWrap="wrap" w="100%">
              <InputGroup className="crm-table-search" width={{ base: "100%", md: "min(320px, 40%)" }} mx={{ base: 0, md: 3 }} my={{ sm: "8px", md: "0" }}>
                <InputLeftElement size="sm" h="100%" pointerEvents="none" zIndex="0"><FiSearch /></InputLeftElement>
                <Input size="sm" fontSize="sm" fontWeight="500" borderRadius="12px" placeholder={t("Search...")} aria-label={t("Search...")} value={query} onChange={(event) => setQuery(event.target.value)} />
              </InputGroup>
              <Button size="sm" mt={{ sm: "5px", md: "0" }} variant="outline" colorScheme="brand" leftIcon={<FiFilter />} onClick={() => setShowFilters((value) => !value)}>
                {t("Filters")}
              </Button>
              {(Object.values(filters).some(Boolean) || sort !== "createdDate" || order !== "desc") && (
                <Button size="sm" variant="outline" colorScheme="red" leftIcon={<FiX />} onClick={() => { setFilters({}); setSort("createdDate"); setOrder("desc"); setPage(1); }}>
                  {t("Clear filters")}
                </Button>
              )}
            </Flex>
          </GridItem>
          <GridItem colSpan={{ base: 12, lg: 2 }} display="flex" justifyContent="end" alignItems="center" textAlign="right" gap="8px" className="crm-table-toolbar__actions">
            <TableTools columns={tableColumns} visible={visible} order={columnOrder} onColumnsChange={setVisible}
              onImport={permissions?.create && permissions?.import !== false ? () => setImportOpen(true) : undefined}
              exports={permissions?.export !== false ? [
                { label: 'Export as CSV', disabled: busy || exporting || !definition || !total, onClick: () => download('csv') },
                { label: 'Export as Excel', disabled: busy || exporting || !definition || !total, onClick: () => download('xlsx') },
              ] : []} />
          </GridItem>
        </Grid>

        {showFilters && (
          <Box className="crm-entity-filters">
            <SimpleGrid columns={{ base: 1, sm: 2, lg: 4, xl: 6 }} spacing="10px">
              {filterNames.map((key) => {
                const field = definition?.fields.find((item) => item.name === key);
                if (!field) return null;
                return field.options?.length ? (
                  <Select key={key} value={filters[key] || ""} aria-label={localized(field.label, language)} onChange={(event) => updateFilter(key, event.target.value)}>
                    <option value="">{localized(field.label, language)}</option>
                    {field.options.map((option) => <option key={option.value} value={option.value}>{localized(option.label, language)}</option>)}
                  </Select>
                ) : !field.relation ? (
                  <Input key={key} placeholder={localized(field.label, language)} value={filters[key] || ""} onChange={(event) => updateFilter(key, event.target.value)} />
                ) : null;
              })}
              {["Properties", "Residences"].includes(moduleName) && ["priceMin", "priceMax"].map((key) => (
                <Input key={key} type="number" min="0" placeholder={t(`estate.${key}`)} value={filters[key] || ""} onChange={(event) => updateFilter(key, event.target.value)} />
              ))}
              <Select value={sort} aria-label={t("estate.sort")} onChange={(event) => setSort(event.target.value)}>
                <option value="createdDate">{t("Created Date")}</option>
                <option value={moduleName === "Properties" ? "title" : moduleName === "Partner Customers" ? "fullName" : "name"}>{t("Name")}</option>
                {["Properties", "Residences"].includes(moduleName) && <option value="price.amount">{t("Price")}</option>}
              </Select>
              <Select value={order} aria-label={t("estate.order")} onChange={(event) => setOrder(event.target.value)}>
                <option value="asc">{t("estate.ascending")}</option>
                <option value="desc">{t("estate.descending")}</option>
              </Select>
            </SimpleGrid>
          </Box>
        )}

        <Box className="crm-entity-table-wrap crm-records-scroll" overflowX="auto" dir={moduleName === "Properties" ? "ltr" : direction}>
          {busy ? (
            <Flex minH="360px" align="center" justify="center"><Spinner /></Flex>
          ) : (
            <Table className="crm-entity-table crm-mobile-records" role="table" sx={hiddenColumnStyles} minW={moduleName === "Residences" ? `${Math.max(640, visible.length * 150)}px` : undefined} dir="ltr">
              <Thead><Tr>{orderedColumns.map(column=><Th key={column.id} hidden={!visible.includes(column.id)} data-mobile-role={column.id==='number'?'index':column.id==='actions'?'actions':'field'} dir={direction}>{column.label}</Th>)}</Tr></Thead>
              <Tbody>{items.map((item,index)=><Tr key={item._id} className="crm-record-row" role="row">
                {orderedColumns.map(column=><Td key={column.id} role="cell" hidden={!visible.includes(column.id)} data-label={column.label} dir={direction}
                  data-mobile-role={column.id==='actions'?'actions':column.id==='number'?'index':column.field?.name===primaryName?'primary':'field'}>
                  {column.id==='number'?(page-1)*pageSize+index+1:column.id==='actions'?<Flex className="crm-row-actions" gap="5px">
                    <ShareRecordButton module={moduleName} record={item} />
                    <Tooltip label={t('Details')}><IconButton size="sm" variant="ghost" colorScheme="blue" aria-label={t('Details')} icon={<FiEye />} onClick={()=>open(item,true)} /></Tooltip>
                    {permissions?.update&&<Tooltip label={t('Edit')}><IconButton size="sm" variant="ghost" colorScheme="teal" aria-label={t('Edit')} icon={<FiEdit3 />} onClick={()=>open(item,false)} /></Tooltip>}
                    {permissions?.delete&&<Tooltip label={t('Delete')}><IconButton size="sm" variant="ghost" colorScheme="red" aria-label={t('Delete')} icon={<FiTrash2 />} onClick={()=>setDeleting(item)} /></Tooltip>}
                  </Flex>:column.field?.name==='status'&&moduleName==='Partner Customers'?<Select size="sm" minW="170px" aria-label={column.label+' · '+name(item)} value={item.status||''} isDisabled={!permissions?.update||Boolean(statusSaving)||!partnerStatusField?.options?.length} onChange={event=>updatePartnerStatus(item,event.target.value)}>
                    <option value="" disabled>{t('Select')}</option>{(partnerStatusField?.options||[]).map(option=><option key={option.value} value={option.value}>{localized(option.label,language)}</option>)}
                  </Select>:column.field?.name===primaryName?<Box><Button variant="link" color="brand.600" whiteSpace="normal" textAlign="start" onClick={()=>open(item,true)}><TableFieldValue field={column.field} value={tableFieldValue(item,column.field)} record={item} /></Button><SharedRecordBadge module={moduleName} record={item}/>{['Properties','Residences'].includes(moduleName)&&<PropertyStatusBadge property={item}/>}</Box>
                    :<TableFieldValue field={column.field} value={tableFieldValue(item,column.field)} record={item} moduleName={moduleName}/>}
                </Td>)}
              </Tr>)}</Tbody>
            </Table>
          )}
          {!busy && !items.length && <Flex className="crm-empty-state" align="center" justify="center"><Text>{t("No Data Found")}</Text></Flex>}
        </Box>

        <RecordPagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} isLoading={busy}
          onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} />
      </Card>

      <RecordImportDialog moduleName={moduleName} isOpen={importOpen} onClose={() => setImportOpen(false)} onImported={() => { setPage(1); if (page === 1) fetchData(); }} />

      <Modal isOpen={record !== null} onClose={() => setRecord(null)} size="5xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent className={`crm-entity-modal${readOnly ? "" : " crm-record-form"}`} dir={direction}>
          <ModalHeader>{t(readOnly ? "Details" : record?._id ? "Edit" : "Add")} · {t(moduleName)}</ModalHeader>
          <ModalCloseButton aria-label={t("Close")} />
          <ModalBody><FormFeedback formik={readOnly ? null : formik} />{error && <Alert status="error"><AlertIcon />{t(`estate.${error}`)}</Alert>}{readOnly && ["Properties", "Residences"].includes(moduleName) && <Box mb={4}><PropertyStatusBadge property={record} /></Box>}{readOnly ? <RecordEditingContext.Provider value={detailEditing}><RecordFields definition={definition} record={record} /></RecordEditingContext.Provider> : form}
            {readOnly && record?.createBy && <Text mt={4}>{t("estate.createdBy")}: <RecordValue name="createBy" value={record.createBy} /></Text>}
          </ModalBody>
          <ModalFooter><Stack direction="row">{readOnly && permissions?.update && <Button variant="brand" leftIcon={<FiEdit3 />} onClick={() => setReadOnly(false)}>{t('details.edit')}</Button>}{!readOnly && <Button variant="brand" isLoading={formik.isSubmitting} isDisabled={!definition} onClick={formik.handleSubmit}>{t("Save")}</Button>}<Button onClick={() => setRecord(null)}>{t("Close")}</Button></Stack></ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={Boolean(deleting)} onClose={() => setDeleting(null)} isCentered>
        <ModalOverlay />
        <ModalContent dir={direction}><ModalHeader>{t("Delete")}</ModalHeader><ModalBody>{t("estate.confirmDelete")}</ModalBody><ModalFooter><Button colorScheme="red" onClick={remove}>{t("Delete")}</Button><Button ms={2} onClick={() => setDeleting(null)}>{t("Cancel")}</Button></ModalFooter></ModalContent>
      </Modal>
      {creatingRelated && <CatalogRecordDialog moduleName={creatingRelated} onClose={() => setCreatingRelated(null)} onCreated={item => {
        formik.setFieldValue(creatingRelated === 'Districts' ? 'district' : 'residence', creatingRelated === 'Districts' ? item.name : item._id);
        setRelatedVersion(value => value + 1);
      }} />}
    </Box>
  );
}

export const PropertiesPage = () => <EntityPage moduleName="Properties" />;
export const PartnerCustomersPage = () => <EntityPage moduleName="Partner Customers" />;
export const ResidencesPage = () => <EntityPage moduleName="Residences" />;
