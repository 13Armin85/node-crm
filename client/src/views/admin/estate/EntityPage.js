import TableTools, { useVisibleColumns } from 'components/table/TableTools';
import RecordImportDialog from 'components/table/RecordImportDialog';
import { exportSpreadsheet } from 'utils/spreadsheet';
import FormFeedback from 'components/dynamicForm/FormFeedback';
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert, AlertIcon, Box, Button, Flex, Heading, Icon, IconButton, Input,
  InputGroup, InputLeftElement, Modal, ModalBody, ModalCloseButton,
  ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, SimpleGrid,
  Spinner, Stack, Table, Tbody, Td, Text, Th, Thead, Tooltip, Tr,
} from "@chakra-ui/react";
import { useFormik, getIn, setIn } from "formik";
import { useParams } from "react-router-dom";
import {
  FiChevronLeft, FiChevronRight, FiEdit3, FiEye, FiFilter, FiHome,
  FiPlus, FiSearch, FiTrash2, FiUsers, FiX,
} from "react-icons/fi";
import Card from "components/card/Card";
import DynamicFormRenderer, { isVisible, fieldPath, localized } from "components/dynamicForm/DynamicFormRenderer";
import { useLanguage } from "i18n";
import { getApi, postApi, putApi, deleteApi } from "services/api";
import { HasAccess } from "../../../redux/accessUtils";
import CurrencyAmount from "components/CurrencyAmount";
import { useFormDefinition, validateFormValues } from "utils/managedForm";
import ShareRecordButton from "components/ShareRecordButton";
import SharedRecordBadge from "components/SharedRecordBadge";
import PropertyStatusBadge from "components/PropertyStatusBadge";
import { entityExportColumns, loadAllExportRows } from "utils/exportRecords";

const propertySections = [
  ["estate.section.basic", (name) => ["title", "description", "category", "subtype", "transactionType"].includes(name)],
  ["estate.section.pricing", (name) => name.startsWith("price.")],
  ["estate.section.location", (name) => ["district", "neighborhood", "isInsideResidence", "residence"].includes(name)],
  ["estate.section.details", (name) => ["bedroom", "buildingAge", "occupancyStatus", "floor"].includes(name) || name.startsWith("area.")],
  ["estate.section.files", (name) => name === "files"],
  ["estate.section.sale", (name) => name.startsWith("sale.")],
  ["estate.section.additional", (name, field) => field.kind === "CUSTOM_FIELD"],
];

const residenceSections = [
  ['estate.section.basic', name => ['name', 'description', 'developer', 'constructionStatus', 'category', 'transactionType'].includes(name)],
  ['estate.section.pricing', name => name.startsWith('price.')],
  ['estate.section.sale', name => name.startsWith('sale.')],
  ['estate.section.location', name => ['country', 'city', 'district', 'neighborhood', 'address', 'postalCode', 'mapUrl'].includes(name)],
  ['estate.section.building', name => ['constructionYear', 'buildingAge', 'completionDate', 'blockCount', 'floorCount', 'unitCount', 'totalArea', 'unitTypes', 'occupancyStatus'].includes(name) || name.startsWith('area.')],
  ['estate.section.amenities', name => ['amenities', 'heatingType', 'parkingCapacity'].includes(name)],
  ['estate.section.management', name => ['managementCompany', 'contactPerson', 'phone', 'email', 'website'].includes(name) || name.startsWith('maintenanceFee.')],
  ['estate.section.files', name => name === 'files'],
  ['estate.section.additional', (name, field) => name === 'notes' || field.kind === 'CUSTOM_FIELD'],
];

const residenceTableColumns = [
  ['transactionType', 'Transaction Type'],
  ['constructionStatus', 'estate.residence.constructionStatus'],
  ['developer', 'estate.residence.developer'],
  ['area.value', 'estate.residence.builtArea'],
  ['building', 'estate.section.building'],
  ['maintenanceFee.amount', 'estate.residence.maintenanceFee'],
  ['contact', 'Contact'],
];

const PAGE_SIZE = 20;

export function EntityPage({ moduleName }) {
  const { t, language, direction } = useLanguage();
  const [permissions] = HasAccess([moduleName]);
  const { id } = useParams();
  const { definition, definitionError } = useFormDefinition(moduleName);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
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
    const params = new URLSearchParams({ q: search, page, limit: PAGE_SIZE, sort, order, ...filters });
    const result = await getApi(`${base}?${params}`);
    if (result.status === 200) {
      setItems(result.data.items);
      setTotal(result.data.total);
    } else setError(result.data?.code || "serverError");
    setBusy(false);
  }, [base, search, page, sort, order, filters]);

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

  const formik = useFormik({
    initialValues,
    enableReinitialize: true,
    validate: values => validateFormValues(definition, values),
    async onSubmit(values, helpers) {
      setError("");
      const result = record?._id ? await putApi(`${base}/${record._id}`, values) : await postApi(base, values);
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
  const name = (item) => item.title || item.fullName || item.companyName || item.name || item.propertyType || item._id;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const dateLocale = language === "fa" ? "fa-IR" : language === "tr" ? "tr-TR" : "en-US";
  const PageIcon = ["Properties", "Residences"].includes(moduleName) ? FiHome : FiUsers;

  const remove = async () => {
    const result = await deleteApi(`${base}/`, deleting._id);
    if (result.status === 200) { setDeleting(null); setNotice("Success"); fetchData(); }
    else { setError(result.data?.code || "serverError"); setDeleting(null); }
  };

  const residenceFieldLabel = (key, fallback) => localized(definition?.fields.find(field => field.name === key)?.label, language) || t(fallback);
  const residenceOption = (key, value) => {
    if (value == null || value === '') return '-';
    const option = definition?.fields.find(field => field.name === key)?.options?.find(option => option.value === value);
    return option ? localized(option.label, language) : t(value);
  };
  const residenceNumber = value => value == null || value === '' ? '-' : Number(value).toLocaleString(dateLocale);

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
  const formSections = moduleName === 'Properties' ? propertySections : moduleName === 'Residences' ? residenceSections : null;
  const form = definition && formSections ? (
    <Stack spacing={5}>
      {formSections.map(([title, matches]) => {
        const fields = definition.fields.filter((field) => matches(field.name, field));
        return fields.some((field) => isVisible(field, formik.values)) ? (
          <Box className="crm-entity-form-section" key={title}>
            <Heading size="sm" className="crm-entity-form-section__title">{t(title)}</Heading>
            <DynamicFormRenderer definition={{ ...definition, fields }} formik={formik} readOnly={readOnly} />
          </Box>
        ) : null;
      })}
    </Stack>
  ) : definition ? <DynamicFormRenderer definition={definition} formik={formik} readOnly={readOnly} /> : <Spinner />;

  const tableColumns = [
    ...(moduleName === 'Properties' ? [{ id: 'number', label: t('estate.rowNumber') }] : []),
    { id: 'name', label: t('Name') },
    { id: 'summary', label: t(moduleName === 'Properties' ? 'Price' : moduleName === 'Residences' ? 'estate.section.location' : 'Phone') },
    ...(moduleName === 'Residences' ? [{ id: 'price', label: t('Price') }, ...residenceTableColumns.map(([id, fallback]) => ({ id, label: residenceFieldLabel(id, fallback) }))] : []),
    ...(moduleName === 'Partner Customers' ? [{ id: 'status', label: localized(partnerStatusField?.label || 'Status', language) }] : []),
    { id: 'createdDate', label: t('Created Date') }, { id: 'actions', label: t('Actions') },
  ];
  const { visible, setVisible } = useVisibleColumns(tableColumns);
  const hiddenColumnStyles = Object.fromEntries(tableColumns.flatMap((column, index) => visible.includes(column.id) ? [] : [[`& tr > :nth-child(${index + 1})`, { display: 'none' }]]));
  const download = async extension => {
    setExporting(true);
    try {
      const rows = await loadAllExportRows(getApi, base, { q: search, sort, order, ...filters });
      await exportSpreadsheet({ jsonArray: rows, csvColumns: entityExportColumns(definition, language, t), fileName: t(moduleName), extension, rightToLeft: language === 'fa' });
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
          {permissions?.create && <Button variant="brand" leftIcon={<FiPlus />} onClick={() => open({}, false)}>{t("Add New")}</Button>}
        </Flex>
      </Flex>

      {error && <Alert status="error" className="crm-page-alert"><AlertIcon />{t(`estate.${error}`)}</Alert>}
      {notice && <Alert status="success" className="crm-page-alert"><AlertIcon />{t(notice)}</Alert>}

      <Card className="crm-entity-card">
        <Flex className="crm-entity-toolbar crm-table-toolbar" align={{ base: "stretch", md: "center" }} direction={{ base: "column", md: "row" }} gap="10px">
          <InputGroup className="crm-entity-search crm-table-search">
            <InputLeftElement h="100%" pointerEvents="none"><FiSearch /></InputLeftElement>
            <Input placeholder={t("Search...")} aria-label={t("Search...")} value={query} onChange={(event) => setQuery(event.target.value)} />
          </InputGroup>
          <Flex className="crm-table-toolbar__actions" gap={2} align="center" flexWrap="wrap">
          <Button size="sm" variant={showFilters ? "solid" : "outline"} colorScheme="brand" leftIcon={<FiFilter />} onClick={() => setShowFilters((value) => !value)}>
            {t("Filters")}
          </Button>
          <TableTools columns={tableColumns} visible={visible} onColumnsChange={setVisible}
            onImport={permissions?.create && permissions?.import !== false ? () => setImportOpen(true) : undefined}
            exports={permissions?.export !== false ? [
              { label: 'Export as CSV', disabled: busy || exporting || !definition || !total, onClick: () => download('csv') },
              { label: 'Export as Excel', disabled: busy || exporting || !definition || !total, onClick: () => download('xlsx') },
            ] : []} />
          </Flex>
          {(Object.values(filters).some(Boolean) || sort !== "createdDate" || order !== "desc") && (
            <Button variant="ghost" leftIcon={<FiX />} onClick={() => { setFilters({}); setSort("createdDate"); setOrder("desc"); setPage(1); }}>
              {t("Clear filters")}
            </Button>
          )}
        </Flex>

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

        <Box className="crm-entity-table-wrap" overflowX="auto" dir={moduleName === "Properties" ? "ltr" : direction}>
          {busy ? (
            <Flex minH="360px" align="center" justify="center"><Spinner /></Flex>
          ) : (
            <Table className="crm-entity-table" sx={hiddenColumnStyles} minW={moduleName === "Residences" ? `${Math.max(640, visible.length * 150)}px` : undefined} dir={moduleName === "Properties" ? "ltr" : direction}>
              <Thead><Tr>{moduleName === "Properties" && <Th dir={direction} textAlign="center" w="64px">{t("estate.rowNumber")}</Th>}<Th dir={direction}>{t("Name")}</Th><Th dir={direction}>{t(moduleName === "Properties" ? "Price" : moduleName === "Residences" ? "estate.section.location" : "Phone")}</Th>{moduleName === "Residences" && <>
                <Th dir={direction}>{t("Price")}</Th>
                {residenceTableColumns.map(([key, fallback]) => <Th key={key} dir={direction} whiteSpace="nowrap">{residenceFieldLabel(key, fallback)}</Th>)}
              </>}{moduleName === "Partner Customers" && <Th>{localized(partnerStatusField?.label || "Status", language)}</Th>}<Th dir={direction}>{t("Created Date")}</Th><Th dir={direction}>{t("Actions")}</Th></Tr></Thead>
              <Tbody>
                {items.map((item, index) => (
                  <Tr key={item._id}>
                    {moduleName === "Properties" && <Td dir="ltr" textAlign="center" fontWeight="700" data-no-translate>{(page - 1) * PAGE_SIZE + index + 1}</Td>}
                    <Td dir={direction}><Flex align="center" gap="10px"><Flex className="crm-entity-row-icon" align="center" justify="center"><Icon as={PageIcon} /></Flex><Box><Text fontWeight="800" data-no-translate>{name(item)}</Text><SharedRecordBadge module={moduleName} record={item} />{["Properties", "Residences"].includes(moduleName) && <PropertyStatusBadge property={item} />}</Box></Flex></Td>
                    <Td dir={direction} data-no-translate>{moduleName === "Properties" ? <CurrencyAmount amount={item.price?.amount} currency={item.price?.currency} compact /> : moduleName === "Residences" ? <Box minW="210px" maxW="280px">
                      <Text fontWeight="600">{[item.city, item.district, item.neighborhood].filter(Boolean).join(" · ") || "-"}</Text>
                      {item.address && <Text mt={1} fontSize="xs" color="var(--crm-muted)" whiteSpace="normal">{item.address}</Text>}
                    </Box> : item.phone || "-"}</Td>
                    {moduleName === "Residences" && <>
                      <Td dir={direction} whiteSpace="nowrap" data-no-translate>{item.price?.amount != null ? <CurrencyAmount amount={item.price.amount} currency={item.price.currency} compact /> : "-"}</Td>
                      <Td dir={direction}>{residenceOption('transactionType', item.transactionType)}</Td>
                      <Td dir={direction}>{residenceOption('constructionStatus', item.constructionStatus)}</Td>
                      <Td dir={direction} data-no-translate>{item.developer || '-'}</Td>
                      <Td dir={direction} whiteSpace="nowrap">
                        <Text data-no-translate>{item.area?.value != null ? `${residenceNumber(item.area.value)} m²` : '-'}</Text>
                        {item.area?.value != null && item.area?.type && <Text fontSize="xs" color="var(--crm-muted)">{residenceOption('area.type', item.area.type)}</Text>}
                        {item.totalArea != null && <Text mt={1} fontSize="xs">{residenceFieldLabel('totalArea', 'estate.residence.siteArea')}: <span data-no-translate>{residenceNumber(item.totalArea)} m²</span></Text>}
                      </Td>
                      <Td dir={direction} whiteSpace="nowrap">
                        {['blockCount', 'floorCount', 'unitCount'].map(key => <Text key={key} fontSize="xs">{residenceFieldLabel(key, `estate.residence.${key}`)}: <span data-no-translate>{residenceNumber(item[key])}</span></Text>)}
                      </Td>
                      <Td dir={direction} whiteSpace="nowrap" data-no-translate>{item.maintenanceFee?.amount != null ? <CurrencyAmount amount={item.maintenanceFee.amount} currency={item.maintenanceFee.currency} compact /> : '-'}</Td>
                      <Td dir={direction} data-no-translate>
                        <Text dir="ltr" whiteSpace="nowrap">{item.phone || '-'}</Text>
                        {item.email && <Text dir="ltr" mt={1} fontSize="xs">{item.email}</Text>}
                      </Td>
                    </>}
                    {moduleName === "Partner Customers" && <Td><Box className="selectOpt"><Select size="sm" minW="170px"
                      aria-label={`${localized(partnerStatusField?.label || "Status", language)} · ${name(item)}`}
                      className={item.status === "PENDING" ? "pending" : item.status === "ACTIVE" ? "completed" : ["LOST", "INACTIVE"].includes(item.status) ? "onHold" : "inProgress"}
                      value={item.status || ""} isDisabled={!permissions?.update || Boolean(statusSaving) || !partnerStatusField?.options?.length}
                      onChange={event => updatePartnerStatus(item, event.target.value)}>
                      <option value="" disabled>{t("Select")}</option>
                      {(partnerStatusField?.options || []).map(option => <option key={option.value} value={option.value}>{localized(option.label, language)}</option>)}
                    </Select></Box></Td>}
                    <Td dir={direction}>{item.createdDate ? new Date(item.createdDate).toLocaleDateString(dateLocale) : "-"}</Td>
                    <Td dir={direction}>
                      <Flex className="crm-row-actions" gap="5px">
                        <ShareRecordButton module={moduleName} record={item} />
                        <Tooltip label={t("Details")}><IconButton size="sm" variant="ghost" colorScheme="blue" aria-label={t("Details")} icon={<FiEye />} onClick={() => open(item, true)} /></Tooltip>
                        {permissions?.update && <Tooltip label={t("Edit")}><IconButton size="sm" variant="ghost" colorScheme="teal" aria-label={t("Edit")} icon={<FiEdit3 />} onClick={() => open(item, false)} /></Tooltip>}
                        {permissions?.delete && <Tooltip label={t("Delete")}><IconButton size="sm" variant="ghost" colorScheme="red" aria-label={t("Delete")} icon={<FiTrash2 />} onClick={() => setDeleting(item)} /></Tooltip>}
                      </Flex>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
          {!busy && !items.length && <Flex className="crm-empty-state" align="center" justify="center"><Text>{t("No Data Found")}</Text></Flex>}
        </Box>

        <Flex className="crm-entity-pagination" align="center" justify="space-between">
          <IconButton aria-label={t("Previous Page")} icon={<FiChevronLeft />} isDisabled={page <= 1 || busy} onClick={() => setPage((value) => value - 1)} />
          <Text><Box as="span" fontWeight="900">{page}</Box> / {pageCount} · {total} {t("records")}</Text>
          <IconButton aria-label={t("Next Page")} icon={<FiChevronRight />} isDisabled={page >= pageCount || busy} onClick={() => setPage((value) => value + 1)} />
        </Flex>
      </Card>

      <RecordImportDialog moduleName={moduleName} isOpen={importOpen} onClose={() => setImportOpen(false)} onImported={() => { setPage(1); if (page === 1) fetchData(); }} />

      <Modal isOpen={record !== null} onClose={() => setRecord(null)} size="5xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent className="crm-entity-modal" dir={direction}>
          <ModalHeader>{t(readOnly ? "Details" : record?._id ? "Edit" : "Add")} · {t(moduleName)}</ModalHeader>
          <ModalCloseButton aria-label={t("Close")} />
          <ModalBody><FormFeedback formik={readOnly ? null : formik} />{error && <Alert status="error"><AlertIcon />{t(`estate.${error}`)}</Alert>}{readOnly && ["Properties", "Residences"].includes(moduleName) && <Box mb={4}><PropertyStatusBadge property={record} /></Box>}{form}
            {readOnly && record?.createBy && <Text mt={4}>{t("estate.createdBy")}: <span data-no-translate>{typeof record.createBy === "object" ? record.createBy.username || record.createBy._id : record.createBy}</span></Text>}
          </ModalBody>
          <ModalFooter><Stack direction="row">{!readOnly && <Button variant="brand" isLoading={formik.isSubmitting} isDisabled={!definition} onClick={formik.handleSubmit}>{t("Save")}</Button>}<Button onClick={() => setRecord(null)}>{t("Close")}</Button></Stack></ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={Boolean(deleting)} onClose={() => setDeleting(null)} isCentered>
        <ModalOverlay />
        <ModalContent dir={direction}><ModalHeader>{t("Delete")}</ModalHeader><ModalBody>{t("estate.confirmDelete")}</ModalBody><ModalFooter><Button colorScheme="red" onClick={remove}>{t("Delete")}</Button><Button ms={2} onClick={() => setDeleting(null)}>{t("Cancel")}</Button></ModalFooter></ModalContent>
      </Modal>
    </Box>
  );
}

export const PropertiesPage = () => <EntityPage moduleName="Properties" />;
export const PartnerCustomersPage = () => <EntityPage moduleName="Partner Customers" />;
export const ResidencesPage = () => <EntityPage moduleName="Residences" />;
