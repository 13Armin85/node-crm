import { LocalizedText } from 'i18n/runtime';
// Chakra imports
import {
  Flex,
  Heading,
  Icon,
  IconButton,
  SimpleGrid,
  useColorModeValue,
  Grid,
  GridItem,
  Progress,
  Box,
  Text,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
// Assets
// Custom components
import { ViewIcon } from "@chakra-ui/icons";
import Card from "components/card/Card";
import MiniStatistics from "components/card/MiniStatistics";
import IconBox from "components/icons/IconBox";
import { useEffect, useState } from "react";
import { LuBuilding2 } from "react-icons/lu";
import { MdAddTask, MdAttachMoney, MdContacts, MdInsights, MdLeaderboard, MdOutlineAssessment, MdOutlineInventory2, MdPeopleAlt, MdPieChart, MdShowChart, MdTaskAlt } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { getApi } from "services/api";
import ReportChart from "../reports/components/reportChart";
import Chart from "components/charts/LineChart.js";
import { HasAccess } from "../../../redux/accessUtils";
import PieChart from "components/charts/PieChart";
import CountUpComponent from "../../../../src/components/countUpComponent/countUpComponent";
import Spinner from 'components/spinner/Spinner';
import { useSelector } from "react-redux";
import { useLanguage } from "i18n";

const DashboardCardHeader = ({ title, subtitle, icon: HeaderIcon = MdInsights, meta, action, mb = 4 }) => {
  const background = useColorModeValue(
    "linear-gradient(135deg, #f8faff 0%, #f1f5ff 100%)",
    "linear-gradient(135deg, rgba(117, 81, 255, .18) 0%, rgba(17, 28, 68, .55) 100%)",
  );
  const borderColor = useColorModeValue("#e8edff", "whiteAlpha.200");
  const titleColor = useColorModeValue("secondaryGray.900", "white");
  const mutedColor = useColorModeValue("secondaryGray.600", "secondaryGray.300");
  const metaBg = useColorModeValue("white", "whiteAlpha.100");

  return (
    <Flex
      className="crm-dashboard-card-header"
      align={{ base: "flex-start", sm: "center" }}
      justify="space-between"
      direction={{ base: "column", sm: "row" }}
      gap={3}
      mb={mb}
      p={3}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="16px"
      bg={background}
      position="relative"
      overflow="hidden"
    >
      <Box
        position="absolute"
        insetInlineStart="0"
        top="10px"
        bottom="10px"
        w="4px"
        borderRadius="full"
        bg="linear-gradient(180deg, #7551ff 0%, #39b8ff 100%)"
      />
      <Flex align="center" minW={0} ps={2}>
        <Flex
          w="42px"
          h="42px"
          flexShrink={0}
          align="center"
          justify="center"
          me={3}
          color="white"
          borderRadius="13px"
          bg="linear-gradient(135deg, #7551ff 0%, #4318ff 100%)"
          boxShadow="0 8px 18px rgba(67, 24, 255, .24)"
        >
          <Icon as={HeaderIcon} w="22px" h="22px" />
        </Flex>
        <Box minW={0}>
          <Heading color={titleColor} size="md" lineHeight="1.25">{title}</Heading>
          {subtitle && <Text mt={1} color={mutedColor} fontSize="sm">{subtitle}</Text>}
        </Box>
      </Flex>
      <Flex align="center" gap={2} ps={{ base: 2, sm: 0 }}>
        {meta !== undefined && (
          <Text
            minW="34px"
            px={2.5}
            py={1}
            textAlign="center"
            color="brand.500"
            bg={metaBg}
            borderRadius="full"
            fontSize="sm"
            fontWeight="800"
            boxShadow="0 4px 12px rgba(15, 23, 42, .06)"
          >
            {meta}
          </Text>
        )}
        {action}
      </Flex>
    </Flex>
  );
};

export default function UserReports() {
  const { t, language, direction } = useLanguage();
  // Chakra Color Mode
  const brandColor = useColorModeValue("brand.500", "white");
  const boxBg = useColorModeValue("secondaryGray.300", "whiteAlpha.100");
  const statisticsItemBg = useColorModeValue("white", "rgba(255, 255, 255, 0.05)");
  const statisticsItemBorder = useColorModeValue("1px solid #edf2f7", "1px solid rgba(255, 255, 255, 0.12)");
  const statisticsItemShadow = useColorModeValue("0 10px 24px rgba(15, 23, 42, 0.06)", "none");
  const statisticsTextColor = useColorModeValue("secondaryGray.900", "white");
  const statisticsMutedColor = useColorModeValue("secondaryGray.600", "secondaryGray.300");
  const statisticsTrackBg = useColorModeValue("secondaryGray.100", "whiteAlpha.200");
  const taskItemBg = useColorModeValue("#f8fafc", "rgba(255, 255, 255, 0.05)");
  const taskItemBorder = useColorModeValue("1px solid #edf2f7", "1px solid rgba(255, 255, 255, 0.1)");
  const taskTotalBg = useColorModeValue("#ebf5ff", "rgba(31, 126, 235, 0.16)");
  const taskTotalBorder = useColorModeValue("1px solid transparent", "1px solid rgba(122, 183, 255, 0.32)");
  const taskTotalColor = useColorModeValue("#1f7eeb", "#9cccff");
  const leadStatStyles = {
    total: {
      bg: useColorModeValue("#ebf5ff", "rgba(122, 183, 255, 0.14)"),
      border: useColorModeValue("1px solid transparent", "1px solid rgba(122, 183, 255, 0.28)"),
      color: useColorModeValue("#1f7eeb", "#9cccff"),
    },
    active: {
      bg: useColorModeValue("#eaf9e6", "rgba(56, 223, 183, 0.14)"),
      border: useColorModeValue("1px solid transparent", "1px solid rgba(56, 223, 183, 0.28)"),
      color: useColorModeValue("#43882f", "#62f0ca"),
    },
    pending: {
      bg: useColorModeValue("#fbf4dd", "rgba(246, 200, 95, 0.14)"),
      border: useColorModeValue("1px solid transparent", "1px solid rgba(246, 200, 95, 0.28)"),
      color: useColorModeValue("#a37f08", "#ffd77b"),
    },
    sold: {
      bg: useColorModeValue("#ffeeeb", "rgba(255, 125, 125, 0.14)"),
      border: useColorModeValue("1px solid transparent", "1px solid rgba(255, 125, 125, 0.28)"),
      color: useColorModeValue("#d6401d", "#ff9a9a"),
    },
  };
  const user = JSON.parse(localStorage.getItem("user"));
  const [isLoding, setIsLoding] = useState(false);

  const [allData, setAllData] = useState([]);
  const [data, setData] = useState([]);
  const [salesSummary, setSalesSummary] = useState(null);
  const [salesLoading, setSalesLoading] = useState(true);
  const navigate = useNavigate();
  const modules = useSelector((state) => state?.modules?.data)
  const [contactsView, taskView, leadView, proprtyView] = HasAccess(["Contacts", "Tasks", "Leads", "Properties"]);

  const fetchData = async () => {
    let responseData = await getApi(user?.role === 'superAdmin' ? `api/status/` : `api/status/?createBy=${user?._id}`);
    setAllData(responseData?.data?.data);
  };


  const fetchProgressChart = async () => {
    setIsLoding(true);
    let result = await getApi(user?.role === 'superAdmin' ? 'api/reporting/line-chart' : `api/reporting/line-chart?createBy=${user?._id}`);
    if (result && result?.status === 200) {
      setData(result?.data)
    }
    setIsLoding(false);
  }
  const fetchSalesSummary = async () => {
    setSalesLoading(true);
    const result = await getApi('api/estate/dashboard/sales-summary');
    if (result?.status === 200) setSalesSummary(result.data);
    setSalesLoading(false);
  };
  useEffect(() => {
    fetchProgressChart()
    fetchSalesSummary()
  }, [])


  const findModuleData = (title) => {
    const filterData = data?.find(item => item?.name === title)
    return filterData?.length || 0
  }

  const findLeadStatus = (title) => {
    const filterData = allData?.leadData?.filter(item => item?.leadStatus === title)
    return filterData?.length || 0
  }
  const findTaskStatus = (title) => {
    const filterData = allData?.taskData?.filter(item => item?.status === title)
    return filterData?.length || 0
  }

  const leadModule = modules?.find(({ moduleName }) => moduleName === "Leads")
  const contactModule = modules?.find(({ moduleName }) => moduleName === "Contacts")
  const propertiesModule = modules?.find(({ moduleName }) => moduleName === "Properties")
  const tasksModule = modules?.find(({ moduleName }) => moduleName === "Tasks")
  const reportModule = modules?.find(({ moduleName }) => moduleName === "Reporting and Analytics")
  const emailModule = modules?.find(({ moduleName }) => moduleName === "Emails")
  const callModule = modules?.find(({ moduleName }) => moduleName === "Calls")

  const taskStatus = [
    {
      name: "Completed",
      status: 'completed',
      length: findTaskStatus('completed'),
      color: "#4d8f3a"
    },
    {
      name: "Pending",
      status: 'pending',
      length: findTaskStatus('pending'),
      color: "#a37f08"
    },
    {
      name: "In Progress",
      status: 'inProgress',
      length: findTaskStatus('inProgress'),
      color: "#7038db"
    },
    {
      name: "Todo",
      status: 'todo',
      length: findTaskStatus('todo'),
      color: "#1f7eeb"
    },
    {
      name: "On Hold",
      status: 'onHold',
      length: findTaskStatus('onHold'),
      color: "#DB5436"
    },
  ]
  const navigateTo = {
    Lead: '/lead',
    Contact: '/contacts',
    Meeting: '/metting',
    Call: '/phone-call',
    Task: '/task',
    Email: '/email',
    Property: '/properties',
  };
  const maxStatisticLength = Math.max(...(data || []).map((item) => item?.length || 0), 1);
  const formatMoney = ({ amount = 0, currency = 'TRY' }) => new Intl.NumberFormat(
    language === 'fa' ? 'fa-IR' : language === 'tr' ? 'tr-TR' : 'en-US',
    { style: 'currency', currency, maximumFractionDigits: 0 },
  ).format(amount);
  const moneyValues = values => values?.length
    ? values.map(value => <Text key={value.currency} fontSize={{ base: 'lg', md: 'xl' }} fontWeight="900" lineHeight="1.3" data-no-translate>{formatMoney(value)}</Text>)
    : <Text fontSize="xl" fontWeight="900">{formatMoney({ amount: 0, currency: 'TRY' })}</Text>;

  useEffect(() => {
    fetchData();
  }, [user?._id]);

  return (
    <>
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap="20px" mb="20px">
        {(taskView?.create || taskView?.update || taskView?.delete || taskView?.view) && (tasksModule?.isActive) &&
          <MiniStatistics
            onClick={() => navigate("/task")}
            startContent={
              <IconBox
                w="56px"
                h="56px"
                bg="linear-gradient(90deg, #4481EB 0%, #04BEFE 100%)"
                icon={<Icon w="28px" h="28px" as={MdAddTask} color="white" />}
              />
            }
            name="Tasks"
            value={findModuleData("Tasks")}
          />}
        {(contactsView?.create || contactsView?.update || contactsView?.delete || contactsView?.view) && (contactModule?.isActive) &&
          < MiniStatistics
            onClick={() => navigate("/contacts")}
            startContent={
              <IconBox
                w="56px"
                h="56px"
                bg={boxBg}
                icon={
                  <Icon w="32px" h="32px" as={MdContacts} color={brandColor} />
                }
              />
            }
            name="Contacts"
            value={findModuleData("Contacts")}
          />}
        {(leadView?.create || leadView?.update || leadView?.delete || leadView?.view) && (leadModule?.isActive) &&
          <MiniStatistics
            onClick={() => navigate("/lead")}
            startContent={
              <IconBox
                w="56px"
                h="56px"
                bg={boxBg}
                icon={
                  <Icon w="32px" h="32px" as={MdLeaderboard} color={brandColor} />
                }
              />
            }
            name="Leads"
            value={findModuleData("Leads")}
          />}
        {(proprtyView?.create || proprtyView?.update || proprtyView?.delete || proprtyView?.view) && (propertiesModule?.isActive) &&
          <MiniStatistics
            onClick={() => navigate("/properties")}
            startContent={
              <IconBox
                w="56px"
                h="56px"
                bg={boxBg}
                icon={
                  <Icon w="32px" h="32px" as={LuBuilding2} color={brandColor} />
                }
              />
            }
            name="Property"
            value={findModuleData("Properties")}
          />}
      </SimpleGrid>

      {(proprtyView?.view || user?.role === 'superAdmin') && propertiesModule?.isActive && (
        <Card className="crm-sales-performance" mb="20px" overflow="hidden">
          <DashboardCardHeader
            title={t('dashboard.salesPerformance')}
            subtitle={t('dashboard.salesPerformanceHint')}
            icon={MdAttachMoney}
          />
          {salesLoading ? <Flex minH="180px" align="center" justify="center"><Spinner /></Flex> : <>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing="4" mb="6">
              <Box className="crm-finance-kpi crm-finance-kpi--success">
                <Icon as={MdAttachMoney} className="crm-finance-kpi__icon" />
                <Text className="crm-finance-kpi__label">{t('dashboard.realizedSales')}</Text>
                <Box className="crm-finance-kpi__value">{moneyValues(salesSummary?.sold?.values)}</Box>
                <Text className="crm-finance-kpi__meta">{salesSummary?.sold?.count || 0} {t('dashboard.soldProperties')}</Text>
              </Box>
              <Box className="crm-finance-kpi crm-finance-kpi--warning">
                <Icon as={MdOutlineInventory2} className="crm-finance-kpi__icon" />
                <Text className="crm-finance-kpi__label">{t('dashboard.unsoldOpportunity')}</Text>
                <Box className="crm-finance-kpi__value">{moneyValues(salesSummary?.available?.values)}</Box>
                <Text className="crm-finance-kpi__meta">{salesSummary?.available?.count || 0} {t('dashboard.availableProperties')}</Text>
              </Box>
              <Box className="crm-finance-kpi crm-finance-kpi--info">
                <Icon as={MdPeopleAlt} className="crm-finance-kpi__icon" />
                <Text className="crm-finance-kpi__label">{t('dashboard.teamSales')}</Text>
                <Text className="crm-finance-kpi__count">{salesSummary?.bySeller?.length || 0}</Text>
                <Text className="crm-finance-kpi__meta">{t('dashboard.teamMember')}</Text>
              </Box>
            </SimpleGrid>
            <Box className="crm-team-sales-table" overflowX="auto" dir={direction}>
              <DashboardCardHeader
                title={t('dashboard.teamSales')}
                icon={MdPeopleAlt}
                meta={salesSummary?.bySeller?.length || 0}
                mb={3}
              />
              {salesSummary?.bySeller?.length ? <Table size="sm">
                <Thead><Tr><Th>{t('dashboard.teamMember')}</Th><Th isNumeric>{t('dashboard.soldCount')}</Th><Th>{t('dashboard.salesAmount')}</Th></Tr></Thead>
                <Tbody>{salesSummary.bySeller.map(person => <Tr key={person.userId}>
                  <Td fontWeight="800" data-no-translate>{person.name || person.userId}</Td>
                  <Td isNumeric fontWeight="800">{person.soldCount}</Td>
                  <Td>{moneyValues(person.values)}</Td>
                </Tr>)}</Tbody>
              </Table> : <Text py="8" textAlign="center" color={statisticsMutedColor}>{t('dashboard.noSales')}</Text>}
            </Box>
          </>}
        </Card>
      )}

      <Grid Grid templateColumns="repeat(12, 1fr)" gap={3} >
        {
          (emailModule?.isActive || callModule?.isActive) &&
          <GridItem rowSpan={2} colSpan={{ base: 12, md: 6 }}>
            <Card>
              <DashboardCardHeader
                title={`${t((emailModule?.isActive && callModule?.isActive) ? "Email and Call" : emailModule?.isActive ? "Email" : callModule?.isActive ? "Call" : "")} ${t("Report")}`}
                icon={MdShowChart}
                action={reportModule?.isActive ?
                  <IconButton
                    color={"green.500"}
                    onClick={() => navigate("/reporting-analytics")}
                    aria-label={t("View")}
                    borderRadius="10px"
                    size="md"
                    icon={<ViewIcon />}
                  />
                : null}
              />
              <ReportChart dashboard={"dashboard"} />
            </Card>
          </GridItem>
        }
        <GridItem rowSpan={2} colSpan={{ base: 12, md: 6 }}>
          <Card>
            <DashboardCardHeader
              title={<LocalizedText text="Module Data Report" />}
              icon={MdOutlineAssessment}
            />
            <Chart dashboard={"dashboard"} data={data} />
          </Card>
        </GridItem>
      </Grid>
      <SimpleGrid gap="20px" columns={{
        base: 1, md: leadView?.view && taskView?.view ? 2 : 2, lg:
          leadView?.view && taskView?.view ? 3 : 2
      }} my="20px">

        {
          data && data.length > 0 &&
          <Card >
            <DashboardCardHeader
              title={<LocalizedText text="Statistics" />}
              icon={MdInsights}
              meta={data.length}
            />
            {
              !isLoding ?
                data && data.length > 0 && data?.map((item, i) => (
                  <Box
                    key={i}
                    bg={statisticsItemBg}
                    border={statisticsItemBorder}
                    boxShadow={statisticsItemShadow}
                    borderRadius={"10px"}
                    p={3}
                    mb={3}
                    cursor={'pointer'}
                    transition="all 0.2s ease"
                    _hover={{ transform: "translateY(-2px)", borderColor: "brand.300" }}
                    onClick={() => navigate(navigateTo[item.name])}
                  >
                    <Flex justifyContent={"space-between"} alignItems={"center"} mb={3}>
                      <Flex alignItems={"center"} minW={0}>
                        <Box
                          w="10px"
                          h="10px"
                          borderRadius="50%"
                          bg={`${item?.color}.400`}
                          me={3}
                          flexShrink={0}
                        />
                        <Text color={statisticsTextColor} fontSize="sm" fontWeight={700} noOfLines={1}>{t(item?.name)}</Text>
                      </Flex>
                      <Text color={statisticsTextColor} fontSize="md" fontWeight={800}>
                        <CountUpComponent targetNumber={item?.length} />
                      </Text>
                    </Flex>
                    <Progress
                      bg={statisticsTrackBg}
                      borderRadius="full"
                      colorScheme={item?.color}
                      size='sm'
                      value={((item?.length || 0) / maxStatisticLength) * 100}
                      width={"100%"}
                    />
                  </Box>

                )) : <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}><Spinner /></div>
            }
          </Card>
        }

        {leadView?.view && (leadModule?.isActive) && <Card className="crm-lead-chart">
          <DashboardCardHeader
            title={<LocalizedText text="Lead Statistics" />}
            icon={MdPieChart}
          />
          {(leadView?.view) &&
            <Grid templateColumns="repeat(12, 1fr)" gap={2}>
              <GridItem colSpan={{ base: 12, md: 6 }}>
                <Box bg={leadStatStyles.total.bg}
                  border={leadStatStyles.total.border}
                  borderRadius={"10px"}
                  cursor={"pointer"}
                  onClick={() => navigate('/lead')}
                  p={2} m={1} textAlign={"center"}>
                  <Heading size="sm" pb={3} color={leadStatStyles.total.color}><LocalizedText text="Total Leads" /></Heading>
                  <Text fontWeight={600} color={leadStatStyles.total.color}><CountUpComponent targetNumber={allData?.leadData?.length || 0} /> </Text>
                </Box>
              </GridItem>
              <GridItem colSpan={{ base: 12, md: 6 }}>
                <Box bg={leadStatStyles.active.bg}
                  border={leadStatStyles.active.border}
                  borderRadius={"10px"}
                  cursor={"pointer"}
                  onClick={() => navigate('/lead', { state: 'active' })}
                  p={2} m={1} textAlign={"center"}>
                  <Heading size="sm" pb={3} color={leadStatStyles.active.color} ><LocalizedText text="Active Leads" /></Heading>
                  <Text fontWeight={600} color={leadStatStyles.active.color}><CountUpComponent targetNumber={findLeadStatus("active")} /></Text>
                </Box>
              </GridItem>
              <GridItem colSpan={{ base: 12, md: 6 }}>
                <Box bg={leadStatStyles.pending.bg}
                  border={leadStatStyles.pending.border}
                  onClick={() => navigate('/lead', { state: 'pending' })}
                  borderRadius={"10px"}
                  cursor={"pointer"}
                  p={2} m={1} textAlign={"center"}>
                  <Heading size="sm" pb={3} color={leadStatStyles.pending.color}><LocalizedText text="Pending Leads" /></Heading>
                  <Text fontWeight={600} color={leadStatStyles.pending.color}><CountUpComponent targetNumber={findLeadStatus("pending")} /></Text>
                </Box>
              </GridItem>

              <GridItem colSpan={{ base: 12, md: 6 }}>
                <Box bg={leadStatStyles.sold.bg}
                  border={leadStatStyles.sold.border}
                  borderRadius={"10px"}
                  cursor={"pointer"}
                  onClick={() => navigate('/lead', { state: 'sold' })}
                  p={2} m={1} textAlign={"center"}>
                  <Heading size="sm" pb={3} color={leadStatStyles.sold.color}><LocalizedText text="Sold Leads" /></Heading>
                  <Text fontWeight={600} color={leadStatStyles.sold.color}><CountUpComponent targetNumber={findLeadStatus("sold")} /></Text>
                </Box>
              </GridItem>
            </Grid>
          }
          <Flex justifyContent={"center"} overflow="visible"  >
            <PieChart leadData={allData?.leadData} />
          </Flex>

        </Card>}

        {taskView?.view && (tasksModule?.isActive) && <Card >
          <DashboardCardHeader
            title={<LocalizedText text="Task Statistics" />}
            icon={MdTaskAlt}
          />
          <Grid templateColumns="repeat(12, 1fr)" gap={2} mb={2}>
            <GridItem colSpan={{ base: 12 }}>
              <Box
                bg={taskTotalBg}
                border={taskTotalBorder}
                onClick={() => navigate('/task')}
                borderRadius={"10px"} cursor={'pointer'}
                p={2} m={1} textAlign={"center"}>
                <Heading size="sm" pb={3} color={taskTotalColor}><LocalizedText text="Total Tasks" /></Heading>
                <Text fontWeight={600} color={taskTotalColor}><CountUpComponent targetNumber={allData?.taskData?.length || 0} /></Text>
              </Box>
            </GridItem>
          </Grid>
          {taskStatus && taskStatus.length > 0 && taskStatus?.map((item, i) => (
            <Box my={1.5} key={i}>
              {/* <Flex justifyContent={"space-between"} cursor={'pointer'} onClick={() => navigate('/task', { state: item.status })} alignItems={"center"} padding={4} backgroundColor={"#0b0b0b17"} borderRadius={"10px"}> */}
              <Flex
                justifyContent={"space-between"}
                cursor={'pointer'}
                alignItems={"center"}
                padding={4}
                bg={taskItemBg}
                border={taskItemBorder}
                borderRadius={"10px"}
              >
                <Flex alignItems={"center"}>
                  <Box height={"18px"} width={"18px"} lineHeight={"18px"} textAlign={"center"} border={`1px solid ${item.color}`} display={"flex"} justifyContent={"center"} alignItems={"center"} borderRadius={"50%"} margin={"0 auto"} >
                    <Box backgroundColor={`${item.color}`} height={"10px"} width={"10px"} borderRadius={"50%"}></Box>
                  </Box>

                  <Text ps={2} fontWeight={"bold"} color={`${item.color}`}>{t(item.name)}</Text>

                </Flex>
                <Box fontWeight={"bold"} color={`${item.color}`}><CountUpComponent targetNumber={item?.length} /></Box>
              </Flex>
            </Box>
          ))}
        </Card>}
      </SimpleGrid>

    </>
  );
}
