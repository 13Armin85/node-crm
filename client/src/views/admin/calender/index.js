import { useEffect, useState } from "react";
import { getApi } from "services/api";
import Calender from "./components/calender";
import { Box, Heading, Text } from "@chakra-ui/react";
import { useLanguage } from "i18n";

const Index = () => {
  const [data, setData] = useState([]);
  const user = JSON.parse(localStorage.getItem("user"));
  const { t } = useLanguage();

  const fetchData = async () => {
    let result = await getApi(
      user?.role === "admin"
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
      <Box className="crm-page-hero crm-section-heading"><Text className="crm-section-heading__eyebrow">{t("Schedule")}</Text><Heading>{t("Calendar")}</Heading><Text>{t("Plan and review team activities")}</Text></Box>
      <Calender fetchData={fetchData} data={data} />
    </Box>
  );
};

export default Index;
