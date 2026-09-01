import React, { useMemo } from "react";
import { Box, Flex, Text, useColorModeValue } from "@chakra-ui/react";
import { useLanguage } from "i18n";

const chartSize = 280;
const center = chartSize / 2;
const segments = [
  { key: "active", label: "Active", color: "#38DFB7", radius: 108 },
  { key: "pending", label: "Pending", color: "#F6C85F", radius: 88 },
  { key: "sold", label: "Sold", color: "#FF7D7D", radius: 68 },
];

const LeadChart = ({ leadData }) => {
  const { t } = useLanguage();
  const trackColor = useColorModeValue("#E9EEF7", "#1B2436");
  const textColor = useColorModeValue("#172033", "#F6F8FB");
  const mutedColor = useColorModeValue("#667085", "#A8B3C7");
  const totalLeads = leadData?.length || 0;

  const counts = useMemo(
    () => ({
      active: leadData?.filter((lead) => lead?.leadStatus === "active")?.length || 0,
      pending: leadData?.filter((lead) => lead?.leadStatus === "pending")?.length || 0,
      sold: leadData?.filter((lead) => lead?.leadStatus === "sold")?.length || 0,
    }),
    [leadData],
  );

  return (
    <Box className="crm-radial-chart">
      <svg className="crm-radial-chart__svg" viewBox={`0 0 ${chartSize} ${chartSize}`}>
        <g transform={`rotate(-90 ${center} ${center})`}>
          {segments.map((segment) => {
            const circumference = 2 * Math.PI * segment.radius;
            const percent = totalLeads ? counts[segment.key] / totalLeads : 0;
            const visibleLength = circumference * percent;

            return (
              <g key={segment.key}>
                <circle
                  cx={center}
                  cy={center}
                  r={segment.radius}
                  fill="none"
                  stroke={trackColor}
                  strokeWidth="14"
                />
                <circle
                  cx={center}
                  cy={center}
                  r={segment.radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={`${visibleLength} ${circumference}`}
                  className="crm-radial-chart__ring"
                />
              </g>
            );
          })}
        </g>
        <text
          x={center}
          y={center - 6}
          textAnchor="middle"
          className="crm-radial-chart__label"
          fill={mutedColor}
        >
          {t("Total")}
        </text>
        <text
          x={center}
          y={center + 28}
          textAnchor="middle"
          className="crm-radial-chart__value"
          fill={textColor}
        >
          {totalLeads}
        </text>
      </svg>

      <Flex className="crm-chart-legend" justify="center" wrap="wrap" gap="12px">
        {segments.map((segment) => (
          <Flex key={segment.key} align="center" gap="7px">
            <Box className="crm-chart-legend__dot" bg={segment.color} />
            <Text fontSize="sm" fontWeight="700" color={mutedColor}>
              {t(segment.label)}: {counts[segment.key]}
            </Text>
          </Flex>
        ))}
      </Flex>
    </Box>
  );
};

export default LeadChart;
