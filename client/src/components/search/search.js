import React from "react";
import { getIn } from "formik";
import { formLabel } from "utils/formValue";
import { matchesSearch } from "utils/searchText";
import { InputGroup, InputLeftElement, Input } from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import { useLanguage } from "i18n";

const CustomSearchInput = ({
  allData,
  setSearchbox,
  setDisplaySearchData,
  searchbox,
  dataColumn,
  onSearch,
  setGetTagValues,
  setGopageValue,
}) => {
  const { t } = useLanguage();
  const handleInputChange = (e) => {
    const searchTerm = e.target.value;
    const columns = (dataColumn || []).filter(column => column?.accessor && column.accessor !== 'action');
    const results = (allData || []).filter(item => matchesSearch(
      columns.length ? columns.map(column => {
        const value = typeof column.accessor === 'function' ? column.accessor(item) : getIn(item, column.accessor);
        return typeof value === 'object' ? formLabel(value) : value;
      }) : Object.values(item).filter(value => typeof value === 'string' || typeof value === 'number'),
      searchTerm,
    ));
    setSearchbox(searchTerm);
    setDisplaySearchData(Boolean(searchTerm.trim()));
    onSearch(results);
    setGetTagValues?.([]);
    setGopageValue?.(1);
  };

  return (
    <InputGroup
      className="crm-table-search"
      width={{ base: "100%", md: "min(320px, 40%)" }}
      mx={{ base: 0, md: 3 }}
      my={{ sm: "8px", md: "0" }}
    >
      <InputLeftElement
        size="sm"
        h="100%"
        pointerEvents="none"
        zIndex="0"
        children={<SearchIcon color="gray.400" />}
      />
      <Input
        type="text"
        size="sm"
        fontSize="sm"
        value={searchbox}
        onChange={handleInputChange}
        fontWeight="500"
        placeholder={t("Search...")}
        borderRadius="12px"
      />
    </InputGroup>
  );
};

export default CustomSearchInput;
