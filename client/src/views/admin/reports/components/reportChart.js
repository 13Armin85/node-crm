import { Box, Flex, Radio, RadioGroup, Select, Stack, Text, useColorModeValue } from "@chakra-ui/react";
import Card from "components/card/Card";
import moment from "moment";
import { useEffect, useMemo, useState } from "react";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useSelector } from "react-redux";
import { postApi } from "services/api";
import { useLanguage } from "i18n";

const seriesColors = ["#7AB7FF", "#38DFB7", "#F6C85F", "#FF7D7D"];
const chartWidth = 760;
const chartHeight = 300;
const padding = { top: 22, right: 22, bottom: 42, left: 42 };

const buildPath = (points) =>
  points.reduce((path, point, index) => {
    const command = index === 0 ? "M" : "L";
    return `${path} ${command} ${point.x} ${point.y}`;
  }, "");

const TrendChart = ({ series }) => {
  const { t } = useLanguage();
  const gridColor = useColorModeValue("rgba(23, 125, 220, 0.12)", "rgba(157, 178, 210, 0.14)");
  const textColor = useColorModeValue("#667085", "#A8B3C7");

  const chart = useMemo(() => {
    const visibleSeries = (series || []).filter((item) => item?.name && item?.data?.length);
    const maxLength = Math.max(...visibleSeries.map((item) => item.data.length), 1);
    const maxValue = Math.max(
      ...visibleSeries.flatMap((item) => item.data.map((point) => Number(point.y) || 0)),
      1,
    );
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    const lines = visibleSeries.map((item, seriesIndex) => {
      const points = item.data.map((point, index) => {
        const x =
          padding.left +
          (maxLength === 1 ? innerWidth / 2 : (index / (maxLength - 1)) * innerWidth);
        const y = padding.top + innerHeight - ((Number(point.y) || 0) / maxValue) * innerHeight;
        return {
          x,
          y,
          label: point.x ? moment(point.x).format("MMM D") : "",
          value: Number(point.y) || 0,
        };
      });

      const linePath = buildPath(points);
      const areaPath =
        points.length > 1
          ? `${linePath} L ${points[points.length - 1].x} ${chartHeight - padding.bottom} L ${points[0].x} ${
              chartHeight - padding.bottom
            } Z`
          : "";

      return {
        ...item,
        points,
        linePath,
        areaPath,
        color: seriesColors[seriesIndex % seriesColors.length],
      };
    });

    return { lines, maxValue };
  }, [series]);

  if (!chart.lines.length) {
    return (
      <Flex className="crm-chart-empty" align="center" justify="center">
        {t("No Data Found")}
      </Flex>
    );
  }

  return (
    <Box className="crm-trend-chart" style={{ "--crm-chart-grid": gridColor }}>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="crm-trend-chart__svg">
        {[0, 1, 2, 3].map((tick) => {
          const y = padding.top + ((chartHeight - padding.top - padding.bottom) / 3) * tick;
          return (
            <line
              key={tick}
              x1={padding.left}
              x2={chartWidth - padding.right}
              y1={y}
              y2={y}
              stroke={gridColor}
              strokeDasharray="5 7"
            />
          );
        })}
        {chart.lines.map((item) => (
          <g key={item.name}>
            {item.areaPath && <path d={item.areaPath} fill={item.color} opacity="0.12" />}
            <path d={item.linePath} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" />
            {item.points.map((point, index) => (
              <circle
                key={`${item.name}-${index}`}
                cx={point.x}
                cy={point.y}
                r="4"
                fill={item.color}
                className="crm-trend-chart__point"
              >
                <title>{`${item.name}: ${point.value}`}</title>
              </circle>
            ))}
          </g>
        ))}
        <text x={padding.left} y={chartHeight - 10} fill={textColor} fontSize="12">
          {chart.lines[0]?.points[0]?.label}
        </text>
        <text x={chartWidth - padding.right} y={chartHeight - 10} fill={textColor} fontSize="12" textAnchor="end">
          {chart.lines[0]?.points[chart.lines[0]?.points.length - 1]?.label}
        </text>
      </svg>
      <Flex className="crm-chart-legend" justify="center" wrap="wrap" gap="12px">
        {chart.lines.map((item) => (
          <Flex key={item.name} align="center" gap="7px">
            <Box className="crm-chart-legend__dot" bg={item.color} />
            <Text fontSize="sm" fontWeight="700" color={textColor}>
              {t(item.name)}
            </Text>
          </Flex>
        ))}
      </Flex>
    </Box>
  );
};

const ReportChart = (props) => {
  const { dashboard } = props;
  const { t } = useLanguage();
  const [reportChart, setReportChart] = useState({});
  const [startDate, setStartDate] = useState(
    new Date(new Date() - 14 * 24 * 60 * 60 * 1000),
  );
  const [endDate, setEndDate] = useState(new Date());
  const [select, setSelect] = useState("all");
  const [selection, setSelection] = useState("day");
  const modules = useSelector((state) => state?.modules?.data);
  const user = JSON.parse(localStorage.getItem("user"));
  const isEmailsActive = modules?.find((item) => item?.moduleName === "Emails");
  const isCallsActive = modules?.find((item) => item?.moduleName === "Calls");
  const moduleEnabled = (module) => module?.isActive !== false;

  const featchChart = async () => {
    const data = {
      startDate: moment(startDate).format("YYYY-MM-DD"),
      endDate: moment(endDate).format("YYYY-MM-DD"),
      filter: selection,
    };
    let result = await postApi(
      user?.role === "admin"
        ? "api/reporting/index"
        : `api/reporting/index?sender=${user?._id}`,
      data,
    );
    if (result?.status === 200) {
      setReportChart(result?.data);
    }
  };

  const series = useMemo(
    () =>
      Object?.keys(reportChart)?.map((key) => {
        const dataSet = reportChart[key][0];
        let seriesData = [];

        if (dataSet?.Emails && moduleEnabled(isEmailsActive)) {
          seriesData = seriesData?.concat(
            dataSet?.Emails?.map((item) => ({
              x: item?.date,
              y: item?.Emailcount,
            })),
          );
        }
        if (dataSet?.Calls && moduleEnabled(isCallsActive)) {
          seriesData = seriesData?.concat(
            dataSet?.Calls?.map((item) => ({ x: item?.date, y: item?.Callcount })),
          );
        }
        if (dataSet?.TextMessages) {
          seriesData = dataSet.TextMessages.map((item) => ({ x: item.date, y: item.TextSentCount }));
        }

        return {
          name:
            key === "Email" && moduleEnabled(isEmailsActive)
              ? "Emails"
              : key === "Call" && moduleEnabled(isCallsActive)
                ? "Call"
                : key === "Text" ? "Text messages" : "",
          data: seriesData,
        };
      }),
    [isCallsActive?.isActive, isEmailsActive?.isActive, reportChart],
  );

  useEffect(() => {
    featchChart();
  }, [startDate, endDate, selection]);

  const selectedSeries =
    select === "all"
      ? series?.filter((series) => series?.name !== "")
      : series?.filter((series) => series?.name === select);

  return (
    <Card>
      {!dashboard && (
        <Box
          display="flex"
          alignItems="center"
          flexWrap={"wrap"}
          justifyContent="space-between"
          mb={4}
        >
          <Select
            value={select}
            onChange={(e) => setSelect(e?.target?.value)}
            size="sm"
            width={{ base: "100%", md: "15%" }}
            mb={{ base: 3, md: "auto" }}
          >
            <option value="all">{t("All")}</option>
            <option value="Emails">{t("Email")}</option>
            <option value="Call">{t("Call")}</option>
            <option value="Text messages">{t("Text messages")}</option>
          </Select>
          <Box
            width={{ base: "100%", md: "auto" }}
            flexWrap={"wrap"}
            justifyContent={"left"}
            mb={{ base: 3, md: "auto" }}
            display="flex"
          >
            <ReactDatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              className="datePickerBorder"
            />
            <ReactDatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              className="datePickerBorder"
            />
          </Box>
          <Box
            width={{ base: "100%", md: "auto" }}
            display={"flex"}
            justifyContent={"right"}
            mb={{ base: 3, md: "auto" }}
          >
            <RadioGroup onChange={(e) => setSelection(e)} value={selection}>
              <Stack direction="row">
                <Radio value="day">{t("Daily")}</Radio>
                <Radio value="week">{t("Weekly")}</Radio>
              </Stack>
            </RadioGroup>
          </Box>
        </Box>
      )}
      <TrendChart series={selectedSeries} />
    </Card>
  );
};

export default ReportChart;
