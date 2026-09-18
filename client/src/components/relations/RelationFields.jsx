import { FormLabel, Grid, GridItem, Select, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { getApi } from "services/api";

const labelOf = (item, type) => {
  if (type === "contact") return [item.title, item.firstName, item.lastName].filter(Boolean).join(" ") || item.email;
  if (type === "lead") return item.leadName || item.leadEmail;
  if (type === "property") return item.title || item.name || item.propertyAddress;
  return item.companyName || item.fullName || item.name || item.email;
};

const RelationSelect = ({ label, name, value, items, type, setFieldValue, multiple }) => (
  <GridItem colSpan={{ base: 12, md: 6 }}>
    <FormLabel fontSize="sm" fontWeight="600">{label}</FormLabel>
    <Select
      name={name}
      value={value || (multiple ? [] : "")}
      multiple={multiple}
      minH={multiple ? "90px" : undefined}
      placeholder={multiple ? undefined : "انتخاب کنید"}
      onChange={(event) => setFieldValue(name, multiple
        ? Array.from(event.target.selectedOptions).map((option) => option.value)
        : event.target.value || null)}
    >
      {items.map((item) => <option value={item._id} key={item._id}>{labelOf(item, type)}</option>)}
    </Select>
    {multiple && <Text fontSize="xs" color="gray.500" mt={1}>برای انتخاب چند مورد Ctrl یا Cmd را نگه دارید.</Text>}
  </GridItem>
);

export default function RelationFields({ values, setFieldValue, contact, lead, partner, properties }) {
  const [options, setOptions] = useState({ contacts: [], leads: [], partners: [], properties: [] });

  useEffect(() => {
    const load = async () => {
      const requests = await Promise.all([
        contact ? getApi("api/contact") : null,
        lead ? getApi("api/lead") : null,
        partner ? getApi("api/estate/Partner%20Customers?limit=100") : null,
        properties ? getApi("api/property") : null,
      ]);
      setOptions({
        contacts: requests[0]?.data || [],
        leads: requests[1]?.data || [],
        partners: requests[2]?.data?.items || [],
        properties: requests[3]?.data || [],
      });
    };
    load();
  }, [contact, lead, partner, properties]);

  return (
    <Grid templateColumns="repeat(12, 1fr)" gap={3} mt={3}>
      {contact && <RelationSelect label="مخاطب مرتبط" name="contact" value={values.contact} items={options.contacts} type="contact" setFieldValue={setFieldValue} />}
      {lead && <RelationSelect label="لید مرتبط" name="lead" value={values.lead} items={options.leads} type="lead" setFieldValue={setFieldValue} />}
      {partner && <RelationSelect label="مشتری همکار" name="partnerCustomer" value={values.partnerCustomer} items={options.partners} type="partner" setFieldValue={setFieldValue} />}
      {properties && <RelationSelect label="املاک مرتبط" name="properties" value={values.properties} items={options.properties} type="property" setFieldValue={setFieldValue} multiple />}
    </Grid>
  );
}
