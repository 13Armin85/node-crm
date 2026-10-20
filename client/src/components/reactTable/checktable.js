import TableTools, { columnKey, useVisibleColumns } from 'components/table/TableTools';
import RecordImportDialog from 'components/table/RecordImportDialog';
import { importModuleFor } from 'utils/recordImport';
import { LocalizedText, tr, withLocalization } from 'i18n/runtime';
import { useLanguage } from 'i18n';
import { useMemo, useState, useEffect, isValidElement, cloneElement } from "react";
import {
  Box,
  Flex,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  Button,
  HStack,
  Tag,
  TagLabel,
  Grid,
  GridItem,
  Checkbox,
  TagCloseButton,
} from "@chakra-ui/react";
import { useColorModeValue } from "@chakra-ui/system";
import { FiFilter, FiLayers } from "react-icons/fi";
import { FaSort, FaSortDown, FaSortUp } from "react-icons/fa";
import { DeleteIcon, AddIcon } from "@chakra-ui/icons";
import {
  useGlobalFilter,
  usePagination,
  useSortBy,
  useTable,
} from "react-table";
import Card from "components/card/Card";
import CountUpComponent from "components/countUpComponent/countUpComponent";
import Pagination from "components/pagination/Pagination";
import Spinner from "components/spinner/Spinner";
import CustomSearchInput from "../search/search";
import AdvanceSearchUsingCustomFields from "../search/advanceSearch";
import DataNotFound from "../notFoundData";
import moment from "moment";
import { useSelector, useDispatch } from "react-redux";
import {
  getSearchData,
  setGetTagValues,
  setSearchValue,
} from "../../redux/slices/advanceSearchSlice";
import { commonUtils } from "utils/utils";
import ShareRecordButton from "components/ShareRecordButton";
import SharedRecordBadge from "components/SharedRecordBadge";
import { canSendRecord, shareModuleForTitle } from "services/recordSharing";
import { exportColumns, selectedExportRows } from "utils/exportRecords";
import { toast } from "react-toastify";
import { normalizeSearchFields, optionText } from "components/search/searchFields";

const CommonCheckTable = (props) => {
  const {
    isLoding,
    title,
    columnData,
    size,
    // dataColumn,
    setSearchedDataOut,
    state,
    allData,
    ManageGrid,
    deleteMany,
    tableCustomFields,
    access,
    // selectedColumns,
    // setSelectedColumns,
    onOpen,
    setDelete,
    selectedValues,
    setSelectedValues,
    checkBox,
    AdvanceSearch,
    searchDisplay,
    setSearchDisplay,
    BackButton,
    searchboxOutside,
    setGetTagValuesOutside,
    setSearchboxOutside,
    selectType,
    customSearch,
    addBtn,
    exportColumn,
    pageHeader = true,
    tableDirection,
  } = props;
  const { direction } = useLanguage();
  const cellDirection = tableDirection ? direction : undefined;
  const sharingModule = shareModuleForTitle(title, tr);
  const showSharing = canSendRecord(sharingModule);
  const { dataLength } = props;
  const { handleSearchType } = props;

  const textColor = useColorModeValue("secondaryGray.900", "white");
  const borderColor = useColorModeValue("gray.200", "whiteAlpha.100");

  const [displaySearchData, setDisplaySearchData] = useState(false);
  const [searchedData, setSearchedData] = useState([]);

  const { columns, visible, setVisible } = useVisibleColumns(columnData || []);
  const [importOpen, setImportOpen] = useState(false);
  const importModule = props.importModule || importModuleFor(title, tr);
  const canImport = Boolean(importModule && (access?.create || access === true) && access?.import !== false);

  const searchedDataOut = useSelector(
    (state) => state?.advanceSearchData?.searchResult
  );
  const searchValue = useSelector(
    (state) => state?.advanceSearchData?.searchValue
  );
  const getTagValues = useSelector(
    (state) => state?.advanceSearchData?.getTagValues
  );
  const data = useMemo(
    () =>
      props.filteredData ?? ((AdvanceSearch ? searchDisplay : displaySearchData)
        ? AdvanceSearch
          ? searchedDataOut
          : searchedData
        : allData),
    [
      props.filteredData,
      searchDisplay,
      displaySearchData,
      AdvanceSearch,
      searchedDataOut,
      searchedData,
      allData,
    ]
  );
  const searchFields = useMemo(
    () => normalizeSearchFields(tableCustomFields, allData),
    [tableCustomFields, allData]
  );

  const [searchbox, setSearchbox] = useState("");
  const [advaceSearch, setAdvaceSearch] = useState(false);
  // const [column, setColumn] = useState('');
  const [gopageValue, setGopageValue] = useState();

  const dispatch = useDispatch();

  const tableInstance = useTable(
    {
      columns,
      data,
      initialState: { pageIndex: 0 },
    },
    useGlobalFilter,
    useSortBy,
    usePagination
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    rows,
    page,
    canPreviousPage,
    canNextPage,
    pageOptions,
    pageCount,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
    state: { pageIndex, pageSize },
  } = tableInstance;

  if (
    pageOptions &&
    pageOptions?.length > 0 &&
    pageOptions?.length < gopageValue
  ) {
    setGopageValue(pageOptions?.length);
  }

  const handleSearch = (results) => {
    AdvanceSearch &&
      dispatch(
        getSearchData({ searchData: results || [], type: handleSearchType })
      );
    AdvanceSearch
      ? setSearchedDataOut?.(results || [])
      : setSearchedData(results || []);
  };

  const handleAdvanceSearch = (values) => {
    dispatch(setSearchValue(values));
    const searchResult = AdvanceSearch
      ? dispatch(
          getSearchData({ values: values, allData: allData, type: props.searchFilterType || title })
        )
      : allData?.filter((item) => {
          return searchFields?.every((field) => {
            const fieldValue = values[field?.name];
            const itemValue = item[field?.name];

            if (field?.type === "select") {
              return !fieldValue || itemValue === fieldValue;
            } else if (field?.type === "number") {
              return (
                [null, undefined, ""]?.includes(fieldValue) ||
                (itemValue !== undefined &&
                  itemValue.toString()?.includes(fieldValue?.toString()))
              );
            } else if (field?.type === "date") {
              const fromDate = values[`from${field?.name}`];
              const toDate = values[`to${field?.name}`];

              if (!fromDate && !toDate) {
                return true; // No date range specified
              }

              const timeItemDate = new Date(itemValue);
              const timeMomentDate = moment(timeItemDate)?.format("YYYY-MM-DD");

              return (
                (!fromDate || timeMomentDate >= fromDate) &&
                (!toDate || timeMomentDate <= toDate)
              );
            } else {
              // Default case for text, email
              return (
                !fieldValue ||
                itemValue?.toLowerCase()?.includes(fieldValue?.toLowerCase())
              );
            }
          });
        });

    const getValue = searchFields?.reduce((result, field) => {
      if (field?.type === "date") {
        const fromDate = values[`from${field?.name}`];
        const toDate = values[`to${field?.name}`];

        if (fromDate || toDate) {
          result?.push({
            name: [`from${field?.name}`, `to${field?.name}`],
            value: `${tr("From")}: ${fromDate || "—"} ${tr("To")}: ${toDate || "—"}`,
          });
        }
      } else if (values[field?.name]) {
        result?.push({
          name: [field?.name],
          value: field?.type === "select"
            ? optionText(field?.options?.find(option => String(option?.value) === String(values[field?.name]))) || values[field?.name]
            : values[field?.name],
        });
      }

      return result;
    }, []);
    dispatch(setGetTagValues(getValue));
    setSearchedData(searchResult);
    setDisplaySearchData(true);
    setAdvaceSearch(false);
    if (setSearchbox) {
      setSearchbox("");
    }
  };

  const handleClear = () => {
    setSearchDisplay && setSearchDisplay(false);
    setDisplaySearchData && setDisplaySearchData(false);
    if (searchboxOutside) {
      setSearchboxOutside("");
    } else {
      setSearchbox("");
    }
    dispatch(setGetTagValues([]));
    if (props?.getTagValuesOutSide) {
      setGetTagValuesOutside([]);
    }
    setGopageValue(1);
  };

  const handleClick = () => {
    onOpen();
  };

  const findStatus = () => {
    const searchResult = allData?.filter(
      (item) =>
        !state ||
        (item?.status &&
          item?.status?.toLowerCase()?.includes(state?.toLowerCase()))
    );
    let getValue = [state || undefined]?.filter((value) => value);

    dispatch(setGetTagValues(getValue));
    AdvanceSearch
      ? setSearchedDataOut && setSearchedDataOut(searchResult)
      : setSearchedData && setSearchedData(searchResult);
    AdvanceSearch
      ? setSearchDisplay && setSearchDisplay(true)
      : setDisplaySearchData && setDisplaySearchData(searchResult);
    setDisplaySearchData(true);
    setAdvaceSearch(false);
  };

  useEffect(() => {
    state && findStatus();
  }, [state, allData]);

  const handleCheckboxChange = (event, value) => {
    if (selectType === "single") {
      if (event?.target?.checked) {
        setSelectedValues && setSelectedValues(value);
      } else {
        setSelectedValues();
      }
    } else if (event?.target?.checked) {
      setSelectedValues &&
        setSelectedValues((prevSelectedValues) => [
          ...prevSelectedValues,
          value,
        ]);
    } else {
      setSelectedValues &&
        setSelectedValues((prevSelectedValues) =>
          prevSelectedValues?.filter((selectedValue) => selectedValue !== value)
        );
    }
  };

  const handleExportLeads = (extension) => {
    selectedValues && selectedValues?.length > 0
      ? downloadCsvOrExcel(extension, selectedValues)
      : downloadCsvOrExcel(extension);
  };

  const recordsToExport = selectedExportRows(rows.map(row => row.original), selectedValues);
  const csvColumns = exportColumns(columns, tr);
  const canExport = ManageGrid !== false && exportColumn !== false && access?.export !== false;

  const downloadCsvOrExcel = async (extension) => {
    try {
      await commonUtils.convertJsonToCsvOrExcel({
        jsonArray: recordsToExport, csvColumns, fileName: title || "data", extension,
        rightToLeft: localStorage.getItem("crm-language") === "fa",
      });
    } catch {
      toast.error(tr("Failed to export data"));
    }
  };

  const handleRemoveFromTag = (name) => {
    const filter = (getTagValues || []).filter((item) => {
      if (Array?.isArray(name?.name)) {
        return name?.name?.toString() !== item.name?.toString();
      }
    });

    let updatedSearchValue = { ...searchValue };
    for (let key in updatedSearchValue) {
      if (updatedSearchValue?.hasOwnProperty(key)) {
        if (name?.name?.includes(key)) {
          delete updatedSearchValue[key];
        }
        if (updatedSearchValue[key] === "") {
          delete updatedSearchValue[key];
        }
      }
    }

    handleAdvanceSearch(updatedSearchValue);

    dispatch(setGetTagValues(filter));
    if (filter?.length === 0) {
      handleClear();
    }
  };

  useEffect(() => {
    AdvanceSearch
      ? setSearchedDataOut && setSearchedDataOut(data)
      : setSearchedData && setSearchedData(data);
  }, []);


  const showPageHero = pageHeader !== false && Boolean(title) && ManageGrid !== false && !size;
  const hasListToolbar = showPageHero || props.uniformToolbar;

  return (
    <>
      {showPageHero && (
        <Flex className="crm-page-hero crm-list-page-hero" align={{ base: "flex-start", md: "center" }} justify="space-between" direction={{ base: "column", md: "row" }} gap="18px">
          <Flex align="center" gap="14px">
            <Flex className="crm-page-hero__icon" align="center" justify="center"><FiLayers /></Flex>
            <Box>
              <Flex align="center" gap="9px" wrap="wrap">
                <Text className="crm-page-hero__title"><LocalizedText text={title} /></Text>
                <Box className="crm-page-hero__count"><CountUpComponent key={data?.length} targetNumber={dataLength ?? data?.length ?? 0} /> <LocalizedText text="records" /></Box>
              </Flex>
              <Text className="crm-page-hero__subtitle"><LocalizedText text="Manage business records from one place" /></Text>
            </Box>
          </Flex>
          <Flex className="crm-list-page-hero__actions" gap="8px" wrap="wrap">
            {addBtn !== false && (access?.create || access === true) && (
              <Button onClick={() => handleClick()} leftIcon={<AddIcon />} className="crm-page-hero__action"><LocalizedText text="Add New" /></Button>
            )}
            {BackButton && BackButton}
          </Flex>
        </Flex>
      )}
      <Card
        data-compact-table={props.compact || ["Leads", "Contacts"].includes(title)}
        className={`crm-data-card${hasListToolbar ? " crm-list-table" : ""}`}
        direction="column"
        w="100%"
        overflow="hidden"
      >
        <Grid className="crm-table-toolbar" templateColumns="repeat(12, 1fr)" gap={3}>
          <GridItem
            colSpan={{ base: 12, lg: hasListToolbar ? 10 : 8 }}
            display={"flex"}
            alignItems={"center"}
          >
            <Flex className="crm-table-toolbar__main" alignItems={"center"} flexWrap={"wrap"} w="100%">
              {title && !hasListToolbar && (
                <Flex className="crm-table-title" align="center" me={{ base: 0, md: 3 }}>
                  <Box className="crm-table-title__mark" />
                  <Text color={textColor} fontSize={{ base: "18px", md: "20px" }} fontWeight="800" textTransform="capitalize">
                    <LocalizedText text={title} />
                  </Text>
                  <Box className="crm-table-count">
                    <CountUpComponent key={data?.length} targetNumber={dataLength ?? data?.length ?? 0} />
                  </Box>
                </Flex>
              )}
              {customSearch !== false && (
                <CustomSearchInput
                  setSearchbox={
                    setSearchboxOutside ? setSearchboxOutside : setSearchbox
                  }
                  setDisplaySearchData={
                    setSearchboxOutside
                      ? props?.setSearchDisplay
                      : setDisplaySearchData
                  }
                  searchbox={searchboxOutside ? searchboxOutside : searchbox}
                  allData={allData}
                  dataColumn={columns}
                  onSearch={handleSearch}
                  setGetTagValues={
                    props?.setGetTagValuesOutside
                      ? props?.setGetTagValuesOutside
                      : setGetTagValues
                  }
                  setGopageValue={setGopageValue}
                />
              )}
              {AdvanceSearch
                ? (isValidElement(AdvanceSearch) ? cloneElement(AdvanceSearch, { size: 'sm', mt: { sm: '5px', md: '0' }, variant: 'outline', colorScheme: 'brand', leftIcon: <FiFilter /> }) : null)
                : AdvanceSearch !== false && (
                    <Button
                      variant="outline"
                      colorScheme="brand"
                      leftIcon={<FiFilter />}
                      mt={{ sm: "5px", md: "0" }}
                      size="sm"
                      onClick={() => setAdvaceSearch(true)}
                    ><LocalizedText text="Filters" /></Button>
                  )}
              {searchDisplay || displaySearchData ? (
                <Button
                  variant="outline"
                  colorScheme="red"
                  size="sm"
                  ms={2}
                  onClick={() => handleClear()}
                ><LocalizedText text="Clear" /></Button>
              ) : (
                ""
              )}
              {selectedValues?.length > 0 && access?.delete && !deleteMany && (
                <DeleteIcon
                  cursor={"pointer"}
                  onClick={() => setDelete(true)}
                  color={"red"}
                  ms={2}
                />
              )}
            </Flex>
          </GridItem>
          {/* Advance filter */}
          <AdvanceSearchUsingCustomFields
            setAdvaceSearch={setAdvaceSearch}
            setGetTagValues={setGetTagValues}
            isLoding={isLoding}
            allData={allData}
            setDisplaySearchData={setDisplaySearchData}
            setSearchedData={setSearchedData}
            advaceSearch={advaceSearch}
            tableCustomFields={searchFields}
            setSearchbox={setSearchbox}
            handleAdvanceSearch={handleAdvanceSearch}
          />
          <GridItem
            colSpan={{ base: 12, lg: hasListToolbar ? 2 : 4 }}
            display={"flex"}
            justifyContent={"end"}
            alignItems={"center"}
            textAlign={"right"}
            gap="8px"
            className="crm-table-toolbar__actions"
          >
            <TableTools
              columns={(columnData || []).map((column, index) => ({ id: columnKey(column, index), label: column.Header }))}
              visible={visible} onColumnsChange={setVisible}
              onImport={ManageGrid !== false && canImport ? () => setImportOpen(true) : undefined}
              exports={ManageGrid !== false && canExport ? [
                { label: selectedValues?.length ? 'Export Selected Data as CSV' : 'Export as CSV', disabled: !recordsToExport.length || isLoding, onClick: () => handleExportLeads('csv') },
                { label: selectedValues?.length ? 'Export Selected Data as Excel' : 'Export as Excel', disabled: !recordsToExport.length || isLoding, onClick: () => handleExportLeads('xlsx') },
              ] : []} />
            {!hasListToolbar && addBtn !== false && (access?.create || access === true) && (
              <Button
                onClick={() => handleClick()}
                size="sm"
                variant="brand"
                leftIcon={<AddIcon />}
              ><LocalizedText text="Add New" /></Button>
            )}
            {BackButton && BackButton}
          </GridItem>
          {(getTagValues || [])?.length > 0 && (
            <GridItem colSpan={12}>
              <HStack className="crm-filter-tags" spacing={2} flexWrap="wrap">
                {(getTagValues || [])?.map((item, index) => (
                  <Tag size="md" p={2} key={`${item?.name ?? item?.value ?? item}-${index}`} borderRadius="full" variant="subtle" colorScheme="blue">
                    <TagLabel><LocalizedText text={item?.value} /></TagLabel>
                    <TagCloseButton onClick={() => handleRemoveFromTag(item)} />
                  </Tag>
                ))}
              </HStack>
            </GridItem>
          )}
        </Grid>
        <Box
          overflowY={"auto"}
          dir={tableDirection}
          className={`${size ? "small-table-fix-container" : "table-fix-container"} crm-table-scroll`}
        >
          <Table
            {...getTableProps()}
            className="crm-data-table"
            dir={tableDirection}
            variant="simple"
            color="gray.500"
            mb="0"
          >
            <Thead zIndex={1}>
              {headerGroups?.map((headerGroup, index) => (
                <Tr {...headerGroup?.getHeaderGroupProps()} key={index}>
                  {headerGroup?.headers?.map((column, index) => (
                    <Th
                      {...column?.getHeaderProps(
                        column?.isSortable !== false &&
                          column?.getSortByToggleProps()
                      )}
                      dir={cellDirection}
                      pe="10px"
                      key={index}
                      borderColor={borderColor}
                    >
                      <Flex
                        align="center"
                        justifyContent={column?.center ? "center" : "start"}
                        fontSize={{ sm: "14px", lg: "16px" }}
                        color={textColor}
                      >
                        <span
                          style={{
                            textTransform: "capitalize",
                            marginRight: "8px",
                          }}
                        >
                          {tr(column?.Header)}
                        </span>
                        {column?.isSortable !== false && (
                          <span>
                            {column?.isSorted ? (
                              column?.isSortedDesc ? (
                                <FaSortDown />
                              ) : (
                                <FaSortUp />
                              )
                            ) : (
                              <FaSort />
                            )}
                          </span>
                        )}
                      </Flex>
                    </Th>
                  ))}
                  {showSharing && <Th>{tr("Send to user")}</Th>}
                </Tr>
              ))}
            </Thead>
            <Tbody {...getTableBodyProps()}>
              {isLoding ? (
                <Tr>
                  <Td colSpan={(columns?.length || 0) + (showSharing ? 1 : 0)}>
                    <Flex
                      justifyContent={"center"}
                      alignItems={"center"}
                      width="100%"
                      color={textColor}
                      fontSize="sm"
                      fontWeight="700"
                    >
                      <Spinner />
                    </Flex>
                  </Td>
                </Tr>
              ) : (data && data?.length === 0) || data === undefined ? (
                <Tr>
                  <Td colSpan={(columns?.length || 0) + (showSharing ? 1 : 0)}>
                    <Box
                      textAlign={"center"}
                      width="100%"
                      color={textColor}
                      fontSize="sm"
                      fontWeight="700"
                    >
                      <DataNotFound />
                    </Box>
                  </Td>
                </Tr>
              ) : (
                page?.map((row, i) => {
                  prepareRow(row);
                  return (
                    <Tr {...row?.getRowProps()} key={row.id}>
                      {row?.cells?.map((cell, index) => {
                        let data = "";
                        columnData?.forEach((item) => {
                          if (cell?.column?.Header === item?.Header) {
                            if (
                              item?.cell &&
                              typeof item?.cell === "function"
                            ) {
                              const renderedCell = item.cell(cell);
                              data = (
                                <Flex
                                  align="center"
                                  justifyContent={
                                    item?.Header === "Action" && "center"
                                  }
                                >
                                  <Box
                                    color={textColor}
                                    fontSize="sm"
                                    fontWeight="700"
                                  >
                                    {renderedCell === " "
                                      ? "-"
                                      : renderedCell}
                                  </Box>
                                </Flex>
                              );
                            } else {
                              data = (
                                <Flex align="center">
                                  {item?.Header === "#" &&
                                    (checkBox || checkBox === undefined) && (
                                      <Checkbox
                                        colorScheme="brandScheme"
                                        value={selectedValues}
                                        isChecked={selectedValues?.includes(
                                          cell?.value
                                        )}
                                        onChange={(event) =>
                                          handleCheckboxChange(
                                            event,
                                            cell?.value
                                          )
                                        }
                                        me="10px"
                                      />
                                    )}

                                  <Text
                                    color={textColor}
                                    fontSize="sm"
                                    fontWeight="700"
                                  >
                                    {item?.Header === "#"
                                      ? cell?.row?.index + 1
                                      : cell?.value
                                        ? cell?.value
                                        : "-"}
                                  </Text>
                                </Flex>
                              );
                            }
                          }
                        });
                        return (
                          <Td
                            {...cell?.getCellProps()}
                            key={index}
                            dir={cellDirection}
                            fontSize={{ sm: "14px" }}
                            minW={{ base: "132px", md: "160px", lg: "auto" }}
                            borderColor="transparent"
                          >
                            {data}
                            {index === row.cells.findIndex(item => !["_id", "action"].includes(item.column.id)) && <SharedRecordBadge module={sharingModule} record={row.original} />}
                          </Td>
                        );
                      })}
                      {showSharing && <Td><ShareRecordButton module={sharingModule} record={row.original} /></Td>}
                    </Tr>
                  );
                })
              )}
            </Tbody>
          </Table>
        </Box>
        {data?.length > 5 && (
          <Pagination
            gotoPage={gotoPage}
            gopageValue={gopageValue}
            setGopageValue={setGopageValue}
            pageCount={pageCount}
            canPreviousPage={canPreviousPage}
            previousPage={previousPage}
            canNextPage={canNextPage}
            pageOptions={pageOptions}
            setPageSize={setPageSize}
            nextPage={nextPage}
            pageSize={pageSize}
            pageIndex={pageIndex}
            dataLength={15}
          />
        )}

        {/* Manage Columns */}
        {importModule && <RecordImportDialog moduleName={importModule} moduleId={props.importModuleId} isOpen={importOpen} onClose={() => setImportOpen(false)} onImported={props.onImported} />}

      </Card>
    </>
  );
};

export default withLocalization(CommonCheckTable);
