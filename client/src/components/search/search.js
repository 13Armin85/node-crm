import React from "react";
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
    const searchTerm = e?.target?.value?.toLowerCase();

    const results = allData?.filter((item) => {
      // Check if any of the specified columns contains the search term
      return dataColumn?.some((column) => {
        const columnValue = item[column?.accessor];

        return columnValue && typeof columnValue === "string"
          ? columnValue?.toLowerCase()?.includes(searchTerm)
          : typeof columnValue === "number" &&
              columnValue?.toString()?.includes(searchTerm);
      });
    });

    setSearchbox(searchTerm ? searchTerm : "");
    setDisplaySearchData(e?.target?.value === "" ? false : true);
    onSearch(results);
    setGetTagValues && setGetTagValues([]);

    if (e?.target?.value === "" && setGopageValue) {
      setGopageValue(1);
    }
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
