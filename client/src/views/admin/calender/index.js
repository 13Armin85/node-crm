import { isAdmin } from 'roles';
import { useEffect, useState } from "react";
import { getApi } from "services/api";
import Calender from "./components/calender";
import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import { FiCalendar } from "react-icons/fi";
import { useLanguage } from "i18n";
import ExcelExportButton from "components/ExcelExportButton";

const Index = () => {
  const [data, setData] = useState([]);
  const user = JSON.parse(localStorage.getItem("user"));
  const { t } = useLanguage();

  const fetchData = async () => {
    let result = await getApi(
      isAdmin(user)
        ? "api/calendar/"
        : `api/calendar/?createBy=${user?._id}`,
    );
    if (result?.status === 200) {
      setData(result?.data);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <Box className="crm-calendar-page">
      <Flex className="crm-page-hero crm-section-heading" align="center" gap="14px">
        <Flex className="crm-page-hero__icon" align="center" justify="center" aria-hidden="true"><FiCalendar /></Flex>
        <Box minW={0}>
          <Text className="crm-section-heading__eyebrow">{t("Schedule")}</Text>
          <Heading className="crm-page-hero__title">{t("Calendar")}</Heading>
          <Text className="crm-page-hero__subtitle">{t("Plan and review team activities")}</Text>
        </Box>
        <ExcelExportButton ms={{ md: "auto" }} fileName={t("Calendar")} rows={data}
          columns={[
            { Header: t("Title"), accessor: "title" },
            { Header: t("Module"), accessor: event => t({ task: "Tasks", meeting: "Meetings", call: "Calls", email: "Emails" }[event.groupId] || event.groupId) },
            { Header: t("Start Date"), accessor: "start" },
            { Header: t("End Date"), accessor: "end" },
            { Header: t("All Day"), accessor: event => t(event.allDay ? "Yes" : "No") },
          ]} />
      </Flex>
      <Calender fetchData={fetchData} data={data} />
    </Box>
  );
};

export default Index;
