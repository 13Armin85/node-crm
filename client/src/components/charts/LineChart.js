import React, { useMemo } from "react";
import { Box, Flex, Text, useColorModeValue } from "@chakra-ui/react";
import { useLanguage } from "i18n";

const lightBarColors = ["#177DDC", "#10A987", "#E5A400", "#E74C3C", "#7038DB", "#0EA5E9"];
const darkBarColors = ["#7AB7FF", "#38DFB7", "#F6C85F", "#FF7D7D", "#B894FF", "#6EE7F9"];

const ModuleBarChart = ({ data }) => {
  const { t } = useLanguage();
  const mutedColor = useColorModeValue("#667085", "#A8B3C7");
  const gridColor = useColorModeValue("rgba(23, 125, 220, 0.1)", "rgba(157, 178, 210, 0.14)");
  const barColors = useColorModeValue(lightBarColors, darkBarColors);

  const chartData = useMemo(
    () =>
      (data || [])
        .filter((item) => item?.name)
        .map((item) => ({
          name: t(item.name),
          value: Number(item.length) || 0,
        })),
    [data, t],
  );

  const maxValue = Math.max(...chartData.map((item) => item.value), 1);

  return (
    <Box className="crm-bar-chart" style={{ "--crm-chart-grid": gridColor }}>
      <Flex className="crm-bar-chart__plot" align="end" gap="14px">
        {chartData.map((item, index) => {
          const height = Math.max((item.value / maxValue) * 100, item.value ? 10 : 2);
          return (
            <Flex className="crm-bar-chart__item" key={`${item.name}-${index}`}>
              <Text className="crm-bar-chart__value">{item.value}</Text>
              <Box
                className="crm-bar-chart__bar"
                bg={barColors[index % barColors.length]}
                style={{ height: `${height}%` }}
                title={`${item.name}: ${item.value}`}
              />
              <Text className="crm-bar-chart__label" color={mutedColor} title={item.name}>
                {item.name}
              </Text>
            </Flex>
          );
        })}
        {!chartData.length && (
          <Flex className="crm-chart-empty" align="center" justify="center">
            {t("No Data Found")}
          </Flex>
        )}
      </Flex>
    </Box>
  );
};

export default ModuleBarChart;
