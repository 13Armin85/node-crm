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

const propertySections = [
  ["estate.section.basic", (name) => ["title", "description", "category", "subtype", "transactionType"].includes(name)],
  ["estate.section.pricing", (name) => name.startsWith("price.")],
  ["estate.section.location", (name) => ["district", "neighborhood", "isInsideResidence", "residence"].includes(name)],
  ["estate.section.details", (name) => ["bedroom", "buildingAge", "occupancyStatus", "floor"].includes(name) || name.startsWith("area.")],
  ["estate.section.files", (name) => name === "files"],
  ["estate.section.sale", (name) => name.startsWith("sale.")],
  ["estate.section.additional", (name, field) => field.kind === "CUSTOM_FIELD"],
];

const PAGE_SIZE = 20;

export function EntityPage({ moduleName }) {
  const { t, language, direction } = useLanguage();
  const [permissions] = HasAccess([moduleName]);
  const { id } = useParams();
  const [definition, setDefinition] = useState(null);
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
  const [record, setRecord] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const base = `api/estate/${encodeURIComponent(moduleName)}`;

  useEffect(() => {
    let active = true;
    getApi(`api/estate/definitions/${encodeURIComponent(moduleName)}`).then((result) => {
      if (!active) return;
      if (result.status === 200) setDefinition(result.data);
      else setError(result.data?.code || "serverError");
    });
    return () => { active = false; };
  }, [moduleName]);

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

  let initialValues = record || {};
  if (definition && !record?._id) {
    for (const field of definition.fields) {
      if (getIn(initialValues, fieldPath(field)) === undefined && field.defaultValue !== undefined) {
        initialValues = setIn(initialValues, fieldPath(field), field.defaultValue);
      }
    }
  }

  const formik = useFormik({
    initialValues,
    enableReinitialize: true,
    validate(values) {
      let errors = {};
      for (const field of definition?.fields || []) {
        if (!isVisible(field, values)) continue;
        const value = getIn(values, fieldPath(field));
        if (field.required && (value === "" || value == null || (Array.isArray(value) && !value.length))) errors = setIn(errors, fieldPath(field), "required");
        if (value !== "" && value != null && ["number", "currency"].includes(field.type) && (!Number.isFinite(value) || (field.min != null && value < field.min) || (field.max != null && value > field.max))) errors = setIn(errors, fieldPath(field), "invalid");
      }
      return errors;
    },
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
    : moduleName === "Partner Customers" ? ["customerType", "status", "district"] : ["district", "neighborhood"];
  const name = (item) => item.title || item.fullName || item.companyName || item.name || item.propertyType || item._id;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const dateLocale = language === "fa" ? "fa-IR" : language === "tr" ? "tr-TR" : "en-US";
  const PageIcon = ["Properties", "Residences"].includes(moduleName) ? FiHome : FiUsers;

  const remove = async () => {
    const result = await deleteApi(`${base}/`, deleting._id);
    if (result.status === 200) { setDeleting(null); setNotice("Success"); fetchData(); }
    else { setError(result.data?.code || "serverError"); setDeleting(null); }
  };

  const form = definition && moduleName === "Properties" ? (
    <Stack spacing={5}>
      {propertySections.map(([title, matches]) => {
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
        {permissions?.create && (
          <Button variant="brand" leftIcon={<FiPlus />} onClick={() => open({}, false)}>{t("Add New")}</Button>
        )}
      </Flex>

      {error && <Alert status="error" className="crm-page-alert"><AlertIcon />{t(`estate.${error}`)}</Alert>}
      {notice && <Alert status="success" className="crm-page-alert"><AlertIcon />{t(notice)}</Alert>}

      <Card className="crm-entity-card">
        <Flex className="crm-entity-toolbar" align={{ base: "stretch", md: "center" }} direction={{ base: "column", md: "row" }} gap="10px">
          <InputGroup className="crm-entity-search">
            <InputLeftElement h="100%" pointerEvents="none"><FiSearch /></InputLeftElement>
            <Input placeholder={t("Search...")} aria-label={t("Search...")} value={query} onChange={(event) => setQuery(event.target.value)} />
          </InputGroup>
          <Button variant={showFilters ? "solid" : "outline"} colorScheme="brand" leftIcon={<FiFilter />} onClick={() => setShowFilters((value) => !value)}>
            {t("Filters")}
          </Button>
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
              {moduleName === "Properties" && ["priceMin", "priceMax"].map((key) => (
                <Input key={key} type="number" min="0" placeholder={t(`estate.${key}`)} value={filters[key] || ""} onChange={(event) => updateFilter(key, event.target.value)} />
              ))}
              <Select value={sort} aria-label={t("estate.sort")} onChange={(event) => setSort(event.target.value)}>
                <option value="createdDate">{t("Created Date")}</option>
                <option value={moduleName === "Properties" ? "title" : moduleName === "Partner Customers" ? "fullName" : "name"}>{t("Name")}</option>
                {moduleName === "Properties" && <option value="price.amount">{t("Price")}</option>}
              </Select>
              <Select value={order} aria-label={t("estate.order")} onChange={(event) => setOrder(event.target.value)}>
                <option value="asc">{t("estate.ascending")}</option>
                <option value="desc">{t("estate.descending")}</option>
              </Select>
            </SimpleGrid>
          </Box>
        )}

        <Box className="crm-entity-table-wrap" overflowX="auto">
          {busy ? (
            <Flex minH="360px" align="center" justify="center"><Spinner /></Flex>
          ) : (
            <Table className="crm-entity-table">
              <Thead><Tr><Th>{t("Name")}</Th><Th>{t(moduleName === "Properties" ? "Price" : "Phone")}</Th><Th>{t("Created Date")}</Th><Th>{t("Actions")}</Th></Tr></Thead>
              <Tbody>
                {items.map((item) => (
                  <Tr key={item._id}>
                    <Td><Flex align="center" gap="10px"><Flex className="crm-entity-row-icon" align="center" justify="center"><Icon as={PageIcon} /></Flex><Text fontWeight="800" data-no-translate>{name(item)}</Text></Flex></Td>
                    <Td data-no-translate>{moduleName === "Properties" ? <CurrencyAmount amount={item.price?.amount} currency={item.price?.currency} compact /> : item.phone || item.district || "-"}</Td>
                    <Td>{item.createdDate ? new Date(item.createdDate).toLocaleDateString(dateLocale) : "-"}</Td>
                    <Td>
                      <Flex className="crm-row-actions" gap="5px">
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

      <Modal isOpen={record !== null} onClose={() => setRecord(null)} size="5xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent className="crm-entity-modal" dir={direction}>
          <ModalHeader>{t(readOnly ? "Details" : record?._id ? "Edit" : "Add")} · {t(moduleName)}</ModalHeader>
          <ModalCloseButton aria-label={t("Close")} />
          <ModalBody>{error && <Alert status="error"><AlertIcon />{t(`estate.${error}`)}</Alert>}{form}
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
