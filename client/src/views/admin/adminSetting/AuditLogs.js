import React, { useEffect, useState } from "react";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Icon,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Skeleton,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
} from "@chakra-ui/react";
import {
  FiActivity,
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiClock,
  FiEdit3,
  FiFilter,
  FiLayers,
  FiList,
  FiLock,
  FiLogIn,
  FiLogOut,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { useLanguage } from "i18n";
import { getApi } from "services/api";
import { getStoredUser } from "services/authSession";
import { isAdmin } from "roles";

const emptyFilters = {
  q: "",
  actorId: "",
  collection: "",
  action: "",
  from: "",
  to: "",
};
const actions = ["create", "update", "delete", "rename", "login", "logout"];
const actionIcons = {
  create: FiPlus,
  update: FiEdit3,
  delete: FiTrash2,
  rename: FiEdit3,
  login: FiLogIn,
  logout: FiLogOut,
};
const sections = {
  User: "Users",
  Contact: "Contacts",
  Lead: "Leads",
  Task: "Tasks",
  Property: "Properties",
  Document: "Documents",
  Notification: "Notifications",
  FormDefinition: "estate.formBuilder",
  RecordShare: "Send item to user",
  PartnerCustomer: "Partner Customers",
  Residence: "Residences",
};
const fields = {
  firstName: "First Name",
  lastName: "Last Name",
  username: "Email",
  phoneNumber: "Phone Number",
  role: "Role",
  password: "Password",
  title: "Title",
  status: "Status",
  priority: "Priority",
  deleted: "Delete",
  createdDate: "Created Date",
  updatedDate: "Modified Date",
  assignedToUser: "Assigned To",
  moduleVisibility: "User data visibility",
  customFields: "Custom Fields",
};
const normalizeResult = (data) => ({
  ...data,
  actors: Array.isArray(data.actors) ? data.actors : [],
  collections: Array.isArray(data.collections) ? data.collections : [],
  items: data.items.map((item) => ({
    ...item,
    changes: Array.isArray(item.changes) ? item.changes : [],
  })),
  total: Number(data.total) || 0,
});

export default function AuditLogs() {
  const { t, language } = useLanguage();
  const rtl = language === "fa";
  const locale = rtl ? "fa-IR" : language === "tr" ? "tr-TR" : "en-US";
  const admin = isAdmin(getStoredUser());
  const [draft, setDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [result, setResult] = useState({
    items: [],
    total: 0,
    actors: [],
    collections: [],
  });
  const [selected, setSelected] = useState(null);
  const activeFilters = Object.values(filters).filter(Boolean).length;
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setSelected(null);
    const load = async () => {
      try {
        const query = new URLSearchParams({ page: String(page), limit: "25" });
        for (const [key, value] of Object.entries(filters))
          if (value && (key !== "actorId" || admin)) {
            const boundary =
              key === "from" || key === "to"
                ? new Date(
                    value + (key === "to" ? "T23:59:59.999" : "T00:00:00"),
                  ).toISOString()
                : value;
            query.set(key, boundary);
          }
        const response = await getApi("api/audit-logs?" + query, undefined, {
          dataScope: false,
        });
        if (!active) return;
        if (response?.status !== 200 || !Array.isArray(response.data?.items))
          throw new Error("Audit request failed");
        setResult(normalizeResult(response.data));
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [filters, page, refresh, admin]);
  const input = (key) => ({
    value: draft[key],
    onChange: (event) =>
      setDraft((previous) => ({ ...previous, [key]: event.target.value })),
  });
  const reset = () => {
    setDraft(emptyFilters);
    setFilters(emptyFilters);
    setPage(1);
  };
  const valueText = (value) =>
    value === "[REDACTED]"
      ? t("audit.redacted")
      : value == null || value === ""
        ? t("audit.emptyValue")
        : typeof value === "boolean"
          ? t("audit." + value)
          : typeof value === "object"
            ? JSON.stringify(value, null, 2)
            : String(value);
  const fieldText = (field) =>
    String(field || "")
      .split(".")
      .map((part) => t(fields[part] || part))
      .join(" / ");
  const dateText = (value) =>
    new Date(value).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  const timeText = (value) =>
    new Date(value).toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
  const actionBadge = (item) => (
    <Badge className="crm-audit-action" data-action={item.action}>
      <Icon as={actionIcons[item.action] || FiActivity} boxSize="13px" />
      {t("audit." + item.action)}
    </Badge>
  );
  const detailsButton = (item) => (
    <Button
      className="crm-audit-details-button"
      size="sm"
      variant="ghost"
      onClick={() => setSelected(item)}
      rightIcon={<Icon as={rtl ? FiArrowLeft : FiArrowRight} />}
      aria-label={
        t("audit.details") +
        ": " +
        (item.recordLabel || item.recordId || item.actorName || "")
      }
    >
      {t("audit.details")}
      <span className="crm-audit-change-count">
        {item.changes.length.toLocaleString(locale)}
      </span>
    </Button>
  );
  const recordInfo = (item) => (
    <Box minW={0}>
      <Text
        className="crm-audit-record-name"
        title={item.recordLabel || item.recordId}
      >
        {item.recordLabel || t("audit." + item.action)}
      </Text>
      {item.changes.length > 0 && (
        <Text className="crm-audit-record-fields" noOfLines={1}>
          {item.changes
            .slice(0, 2)
            .map((change) => fieldText(change.field))
            .join(" / ")}
          {item.changes.length > 2
            ? " +" + (item.changes.length - 2).toLocaleString(locale)
            : ""}
        </Text>
      )}
      {item.recordId && (
        <Tooltip label={item.recordId}>
          <Text className="crm-audit-record-id" dir="ltr">
            #{item.recordId.slice(-8)}
          </Text>
        </Tooltip>
      )}
    </Box>
  );
  const person = (item) => (
    <Flex gap={3} align="center" minW={0}>
      <Avatar
        className="crm-audit-avatar"
        size="sm"
        name={item.actorName || item.actorUsername}
      />
      <Box minW={0}>
        <Text className="crm-audit-person-name">
          {item.actorName || item.actorUsername}
        </Text>
        <Text className="crm-audit-person-email" dir="ltr">
          {item.actorUsername}
        </Text>
      </Box>
    </Flex>
  );
  return (
    <Box
      className="crm-audit-logs"
      dir={rtl ? "rtl" : "ltr"}
      textAlign={rtl ? "right" : "left"}
    >
      <Box className="crm-audit-hero">
        <Flex className="crm-audit-hero-top" justify="space-between" gap={4}>
          <Flex gap={4} align="center" minW={0}>
            <Flex className="crm-audit-hero-icon">
              <Icon as={FiActivity} />
            </Flex>
            <Box minW={0}>
              <Text className="crm-audit-eyebrow">{t("audit.history")}</Text>
              <Heading className="crm-audit-title" size="lg">
                {t("Logs")}
              </Heading>
            </Box>
          </Flex>
          <Button
            className="crm-audit-refresh"
            leftIcon={<Icon as={FiRefreshCw} />}
            onClick={() => setRefresh((previous) => previous + 1)}
            isLoading={loading}
            loadingText={t("audit.refresh")}
          >
            {t("audit.refresh")}
          </Button>
        </Flex>
        <Text className="crm-audit-description">
          {t(admin ? "audit.allHint" : "audit.ownHint")}
        </Text>
        <Flex className="crm-audit-scope" gap={2} align="center">
          <Icon as={FiShield} boxSize="14px" />
          <Text>{t(admin ? "audit.adminScope" : "audit.personalScope")}</Text>
        </Flex>
      </Box>
      <SimpleGrid
        className="crm-audit-statistics"
        columns={{ base: 2, lg: 4 }}
        spacing={3}
      >
        {[
          ["total", FiLayers, result.total],
          ["created", FiPlus, result.summary?.create],
          ["updated", FiEdit3, result.summary?.update],
          ["removed", FiTrash2, result.summary?.delete],
        ].map(([key, icon, value]) => (
          <Flex
            className="crm-audit-stat"
            data-tone={key}
            key={key}
            align="center"
            gap={3}
          >
            <Flex className="crm-audit-stat-icon">
              <Icon as={icon} />
            </Flex>
            <Box>
              <Text className="crm-audit-stat-label">{t("audit." + key)}</Text>
              <Skeleton isLoaded={!loading} minW="45px" borderRadius="6px">
                <Text className="crm-audit-stat-value">
                  {error || value == null
                    ? "\u2014"
                    : Number(value).toLocaleString(locale)}
                </Text>
              </Skeleton>
            </Box>
          </Flex>
        ))}
      </SimpleGrid>
      <Box
        as="form"
        className="crm-audit-filter-panel"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setFilters({ ...draft });
        }}
      >
        <Flex justify="space-between" gap={3} align="center" mb={4}>
          <Flex gap={2} align="center">
            <Icon as={FiFilter} color="var(--crm-primary)" />
            <Heading size="sm">{t("audit.filters")}</Heading>
            {activeFilters > 0 && (
              <Badge className="crm-audit-filter-count">
                {activeFilters.toLocaleString(locale)}
              </Badge>
            )}
          </Flex>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            color="var(--crm-muted)"
            leftIcon={<Icon as={FiX} />}
            onClick={reset}
          >
            {t("audit.reset")}
          </Button>
        </Flex>
        <FormControl mb={4}>
          <FormLabel htmlFor="audit-search" className="crm-audit-search-label">
            {t("Search")}
          </FormLabel>
          <Box className="crm-audit-search">
            <Icon as={FiSearch} />
            <Input
              id="audit-search"
              maxLength={150}
              placeholder={t("audit.search")}
              {...input("q")}
            />
          </Box>
        </FormControl>
        <SimpleGrid columns={{ base: 2, xl: admin ? 5 : 4 }} spacing={3}>
          {admin && (
            <FormControl gridColumn={{ base: "1 / -1", xl: "auto" }}>
              <FormLabel htmlFor="audit-actor">{t("audit.actor")}</FormLabel>
              <Select id="audit-actor" {...input("actorId")}>
                <option value="">{t("audit.allActors")}</option>
                {result.actors.map((actor) => (
                  <option key={actor._id} value={actor._id}>
                    {actor.name || actor.username}
                    {actor.name && actor.username
                      ? " (" + actor.username + ")"
                      : ""}
                  </option>
                ))}
              </Select>
            </FormControl>
          )}
          <FormControl>
            <FormLabel htmlFor="audit-action">{t("audit.action")}</FormLabel>
            <Select id="audit-action" {...input("action")}>
              <option value="">{t("audit.allActions")}</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {t("audit." + action)}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel htmlFor="audit-collection">
              {t("audit.collection")}
            </FormLabel>
            <Select id="audit-collection" {...input("collection")}>
              <option value="">{t("audit.allCollections")}</option>
              {result.collections.map((name) => (
                <option key={name} value={name}>
                  {t(sections[name] || name)}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel htmlFor="audit-from">{t("audit.from")}</FormLabel>
            <Input
              id="audit-from"
              type="date"
              max={draft.to || undefined}
              {...input("from")}
            />
          </FormControl>
          <FormControl>
            <FormLabel htmlFor="audit-to">{t("audit.to")}</FormLabel>
            <Input
              id="audit-to"
              type="date"
              min={draft.from || undefined}
              {...input("to")}
            />
          </FormControl>
        </SimpleGrid>
        <Flex
          className="crm-audit-filter-footer"
          justify="space-between"
          align="center"
          gap={3}
        >
          <Text>
            <Icon as={FiLock} />
            {t("audit.securityHint")}
          </Text>
          <Button
            type="submit"
            colorScheme="blue"
            leftIcon={<Icon as={FiFilter} />}
          >
            {t("audit.apply")}
          </Button>
        </Flex>
      </Box>
      <Box className="crm-audit-results" aria-busy={loading}>
        <Flex
          className="crm-audit-results-header"
          align="center"
          justify="space-between"
          gap={3}
        >
          <Flex align="center" gap={2}>
            <Icon as={FiList} color="var(--crm-primary)" />
            <Heading size="sm">{t("audit.activityList")}</Heading>
            {!loading && !error && (
              <Badge className="crm-audit-results-count">
                {result.total.toLocaleString(locale)}
              </Badge>
            )}
          </Flex>
          <Text>
            {t(activeFilters ? "audit.filteredResults" : "audit.latestFirst")}
          </Text>
        </Flex>
        {loading ? (
          <Flex
            className="crm-audit-state"
            role="status"
            direction="column"
            gap={4}
            align="center"
          >
            <Spinner color="var(--crm-primary)" thickness="3px" />
            <Text>{t("Loading")}</Text>
          </Flex>
        ) : error ? (
          <Box className="crm-audit-state crm-audit-error" role="alert">
            <Flex className="crm-audit-state-icon">
              <Icon as={FiAlertCircle} />
            </Flex>
            <Heading size="sm">{t("audit.loadFailed")}</Heading>
            <Text>{t("audit.error")}</Text>
            <Button
              leftIcon={<Icon as={FiRefreshCw} />}
              colorScheme="blue"
              variant="outline"
              onClick={() => setRefresh((previous) => previous + 1)}
            >
              {t("Retry")}
            </Button>
          </Box>
        ) : !result.items.length ? (
          <Box className="crm-audit-state">
            <Flex className="crm-audit-state-icon">
              <Icon as={FiActivity} />
            </Flex>
            <Heading size="sm">{t("audit.empty")}</Heading>
            <Text>
              {t(activeFilters ? "audit.emptyFilteredHint" : "audit.startHint")}
            </Text>
            {activeFilters > 0 && (
              <Button variant="outline" onClick={reset}>
                {t("audit.reset")}
              </Button>
            )}
          </Box>
        ) : (
          <>
            <Box
              className="crm-audit-table-scroll"
              display={{ base: "none", lg: "block" }}
            >
              <Table className="crm-audit-table" size="sm">
                <Thead>
                  <Tr>
                    {[
                      "time",
                      "actor",
                      "action",
                      "collection",
                      "record",
                      "details",
                    ].map((key) => (
                      <Th key={key} textAlign="start">
                        {t("audit." + key)}
                      </Th>
                    ))}
                  </Tr>
                </Thead>
                <Tbody>
                  {result.items.map((item) => (
                    <Tr key={item._id}>
                      <Td>
                        <Flex gap={2} align="flex-start">
                          <Icon as={FiClock} className="crm-audit-clock" />
                          <Box whiteSpace="nowrap">
                            <Text className="crm-audit-date">
                              {dateText(item.createdAt)}
                            </Text>
                            <Text className="crm-audit-time">
                              {timeText(item.createdAt)}
                            </Text>
                          </Box>
                        </Flex>
                      </Td>
                      <Td>{person(item)}</Td>
                      <Td>{actionBadge(item)}</Td>
                      <Td>
                        <span className="crm-audit-section-tag">
                          {t(sections[item.collection] || item.collection)}
                        </span>
                      </Td>
                      <Td maxW="220px">{recordInfo(item)}</Td>
                      <Td>{detailsButton(item)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
            <Box
              className="crm-audit-mobile-list"
              display={{ base: "block", lg: "none" }}
            >
              {result.items.map((item) => (
                <Box className="crm-audit-mobile-event" key={item._id}>
                  <Flex justify="space-between" align="center" gap={2} mb={4}>
                    {person(item)}
                    {actionBadge(item)}
                  </Flex>
                  <Flex align="center" justify="space-between" gap={3} mb={3}>
                    {recordInfo(item)}
                    <Text className="crm-audit-section-tag">
                      {t(sections[item.collection] || item.collection)}
                    </Text>
                  </Flex>
                  <Flex justify="space-between" align="center" gap={2}>
                    <Text className="crm-audit-mobile-time">
                      <Icon as={FiClock} />
                      {dateText(item.createdAt)} / {timeText(item.createdAt)}
                    </Text>
                    {detailsButton(item)}
                  </Flex>
                </Box>
              ))}
            </Box>
          </>
        )}
        {!loading && !error && result.total > 0 && (
          <Flex
            className="crm-audit-pagination"
            align="center"
            justify="space-between"
            gap={3}
            wrap="wrap"
          >
            <Text>
              {t("audit.total")}: {result.total.toLocaleString(locale)} &middot;{" "}
              {t("audit.page")}: {page.toLocaleString(locale)}
            </Text>
            <Flex gap={2}>
              <Button
                size="sm"
                variant="outline"
                isDisabled={page <= 1}
                onClick={() => setPage((previous) => previous - 1)}
              >
                {t("audit.previous")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                isDisabled={page * 25 >= result.total}
                onClick={() => setPage((previous) => previous + 1)}
              >
                {t("audit.next")}
              </Button>
            </Flex>
          </Flex>
        )}
      </Box>
      <Modal
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
        size="4xl"
        scrollBehavior="inside"
      >
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent className="crm-audit-modal" dir={rtl ? "rtl" : "ltr"}>
          <ModalHeader>
            <Text className="crm-audit-eyebrow">{t("audit.history")}</Text>
            <Heading size="md">{t("audit.details")}</Heading>
          </ModalHeader>
          <ModalCloseButton aria-label={t("Close")} />
          <ModalBody>
            {selected && (
              <>
                <Flex
                  className="crm-audit-detail-meta"
                  align="center"
                  justify="space-between"
                  gap={3}
                  wrap="wrap"
                >
                  {person(selected)}
                  <Flex align="center" gap={3}>
                    {actionBadge(selected)}
                    <Text className="crm-audit-time">
                      {dateText(selected.createdAt)} /{" "}
                      {timeText(selected.createdAt)}
                    </Text>
                  </Flex>
                </Flex>
                <Flex
                  className="crm-audit-detail-record"
                  gap={2}
                  align="center"
                >
                  <Icon as={FiLayers} />
                  <Text>
                    {t(sections[selected.collection] || selected.collection)}
                    {selected.recordLabel ? " / " + selected.recordLabel : ""}
                  </Text>
                </Flex>
                {selected.changes.length ? (
                  <Box role="list" className="crm-audit-change-list">
                    {selected.changes.map((change, index) => (
                      <Box
                        role="listitem"
                        className="crm-audit-change"
                        key={index}
                      >
                        <Flex
                          className="crm-audit-change-heading"
                          gap={2}
                          align="center"
                        >
                          <span>{(index + 1).toLocaleString(locale)}</span>
                          <Text>{fieldText(change.field)}</Text>
                        </Flex>
                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                          <Box className="crm-audit-value crm-audit-value-before">
                            <Text className="crm-audit-value-label">
                              {t("audit.before")}
                            </Text>
                            <Text
                              dir="auto"
                              className={
                                change.before === "[REDACTED]"
                                  ? "crm-audit-redacted"
                                  : ""
                              }
                            >
                              {change.before === "[REDACTED]" && (
                                <Icon as={FiLock} />
                              )}
                              {valueText(change.before)}
                            </Text>
                          </Box>
                          <Box className="crm-audit-value crm-audit-value-after">
                            <Text className="crm-audit-value-label">
                              {t("audit.after")}
                            </Text>
                            <Text
                              dir="auto"
                              className={
                                change.after === "[REDACTED]"
                                  ? "crm-audit-redacted"
                                  : ""
                              }
                            >
                              {change.after === "[REDACTED]" && (
                                <Icon as={FiLock} />
                              )}
                              {valueText(change.after)}
                            </Text>
                          </Box>
                        </SimpleGrid>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Box className="crm-audit-state">
                    <Icon as={FiShield} boxSize={8} />
                    <Text>{t("audit.noChanges")}</Text>
                  </Box>
                )}
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              {t("Close")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
