import RecordPagination from "components/pagination/RecordPagination";
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
  Tr,
} from "@chakra-ui/react";
import {
  FiActivity,
  FiAlertCircle,
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
import { auditActivityText, auditSectionName } from "services/auditMessages";
import ExcelExportButton from "components/ExcelExportButton";
import { loadAllExportRows } from "utils/exportRecords";

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
// Both the table and export use applied filters and the same local-day boundaries.
const auditQuery = (filters, admin) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value && (key !== "actorId" || admin)) {
      query.set(
        key,
        key === "from" || key === "to"
          ? new Date(
              value + (key === "to" ? "T23:59:59.999" : "T00:00:00"),
            ).toISOString()
          : value,
      );
    }
  return query;
};
const normalizeResult = (data) => ({
  ...data,
  actors: Array.isArray(data.actors) ? data.actors : [],
  collections: Array.isArray(data.collections) ? data.collections : [],
  items: data.items,
  total: Number(data.total) || 0,
});

export default function AuditLogs() {
  const { t, language } = useLanguage();
  const rtl = language === "fa";
  const locale = rtl ? "fa-IR" : language === "tr" ? "tr-TR" : "en-US";
  const admin = isAdmin(getStoredUser());
  const [draft, setDraft] = useState(() => {
    const actorId = new URLSearchParams(window.location.search).get("actorId");
    return {
      ...emptyFilters,
      actorId: admin && /^[a-f\d]{24}$/i.test(actorId || "") ? actorId : "",
    };
  });
  const [filters, setFilters] = useState(() => draft);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [result, setResult] = useState({
    items: [],
    total: 0,
    actors: [],
    collections: [],
  });
  const activeFilters = Object.entries(filters).filter(
    ([key, value]) => key !== "actorId" && value,
  ).length;
  const currentActor = result.actors.find(
    (actor) => String(actor._id) === filters.actorId,
  );
  const chooseActor = (actorId) => {
    setDraft((previous) => ({ ...previous, actorId }));
    setFilters((previous) => ({ ...previous, actorId }));
    setPage(1);
  };
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    const load = async () => {
      try {
        const query = auditQuery(filters, admin);
        query.set("page", String(page));
        query.set("limit", String(pageSize));
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
  }, [filters, page, pageSize, refresh, admin]);
  const input = (key) => ({
    value: draft[key],
    onChange: (event) =>
      setDraft((previous) => ({ ...previous, [key]: event.target.value })),
  });
  const reset = () => {
    const clean = { ...emptyFilters, actorId: filters.actorId };
    setDraft(clean);
    setFilters(clean);
    setPage(1);
  };
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
  const exportColumns = [
    {
      Header: t("audit.time"),
      accessor: (item) =>
        dateText(item.createdAt) + " / " + timeText(item.createdAt),
    },
    {
      Header: t("audit.actor"),
      accessor: (item) => item.actorName || item.actorUsername || t("User"),
    },
    { Header: t("audit.username"), accessor: "actorUsername" },
    {
      Header: t("audit.collection"),
      accessor: (item) => auditSectionName(item.collection, t),
    },
    {
      Header: t("audit.action"),
      accessor: (item) => t("audit." + item.action),
    },
    {
      Header: t("audit.activity"),
      accessor: (item) => auditActivityText(item, t, language),
    },
  ];
  const exportRows = () =>
    loadAllExportRows(
      (path) => getApi(path, undefined, { dataScope: false }),
      "api/audit-logs",
      Object.fromEntries(auditQuery(filters, admin)),
    );
  const actionBadge = (item) => (
    <Badge className="crm-audit-action" data-action={item.action}>
      <Icon as={actionIcons[item.action] || FiActivity} boxSize="13px" />
      {t("audit." + item.action)}
    </Badge>
  );
  const activity = (item) => (
    <Box className="crm-audit-readable-activity">
      <Text>{auditActivityText(item, t, language)}</Text>
      <Text className="crm-audit-activity-section">
        {auditSectionName(item.collection, t)}
      </Text>
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
        <Flex
          className="crm-audit-hero-top"
          justify="space-between"
          gap={4}
          wrap="wrap"
        >
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
          <Flex gap={2} align="center" wrap="wrap">
            <ExcelExportButton
              label="audit.exportExcel"
              title={t("audit.exportHint")}
              loadRows={exportRows}
              columns={exportColumns}
              fileName={"audit-logs-" + new Date().toISOString().slice(0, 10)}
              isDisabled={loading || error || !result.total}
            />
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
        </Flex>
        <Text className="crm-audit-description">
          {t(admin ? "audit.allHint" : "audit.ownHint")}
        </Text>
        <Flex className="crm-audit-scope" gap={2} align="center">
          <Icon as={FiShield} boxSize="14px" />
          <Text>{t(admin ? "audit.adminScope" : "audit.personalScope")}</Text>
        </Flex>
      </Box>
      {admin && (
        <Box className="crm-audit-user-scope">
          <FormControl>
            <FormLabel htmlFor="audit-actor">{t("audit.chooseUser")}</FormLabel>
            <Select
              id="audit-actor"
              value={filters.actorId}
              onChange={(event) => chooseActor(event.target.value)}
            >
              <option value="">{t("audit.allActors")}</option>
              {result.actors.map((actor) => (
                <option key={actor._id} value={actor._id}>
                  {actor.name || actor.username}
                  {actor.name && actor.username
                    ? " (" + actor.username + ")"
                    : ""}
                  {actor.inactive ? " - " + t("audit.formerUser") : ""}
                </option>
              ))}
            </Select>
          </FormControl>
          <Box>
            <Text className="crm-audit-user-scope-title">
              {filters.actorId
                ? t("audit.userHistory") +
                  ": " +
                  (currentActor?.name || currentActor?.username || t("User"))
                : t("audit.everyoneHistory")}
            </Text>
            <Text className="crm-audit-user-scope-hint">
              {t("audit.chooseUserHint")}
            </Text>
          </Box>
        </Box>
      )}
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
                  {auditSectionName(name, t)}
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
                    {["time", "actor", "activity"].map((key) => (
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
                      <Td>
                        <Flex align="flex-start" gap={3}>
                          {actionBadge(item)}
                          {activity(item)}
                        </Flex>
                      </Td>
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
                  {activity(item)}
                  <Text className="crm-audit-mobile-time" mt={4}>
                    <Icon as={FiClock} />
                    {dateText(item.createdAt)} / {timeText(item.createdAt)}
                  </Text>
                </Box>
              ))}
            </Box>
          </>
        )}
        {!loading && !error && result.total > 0 && (
          <RecordPagination page={page} pageCount={Math.ceil(result.total / pageSize)} total={result.total}
            pageSize={pageSize} isLoading={loading} onPageChange={setPage}
            onPageSizeChange={size => { setPageSize(size); setPage(1); }} />
        )}
      </Box>
    </Box>
  );
}
