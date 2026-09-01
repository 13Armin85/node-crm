import { Box, Flex, Grid, Text, useColorModeValue } from "@chakra-ui/react";
import Card from "components/card/Card";
import { useMemo, useState } from "react";
import "react-datepicker/dist/react-datepicker.css";

const colors = ["#7AB7FF", "#38DFB7", "#F6C85F", "#FF7D7D"];

const DonutChart = () => {
  const [chartSeries] = useState([44, 55, 13, 33]);
  const trackColor = useColorModeValue("#E9EEF7", "#1B2436");
  const textColor = useColorModeValue("#172033", "#F6F8FB");
  const mutedColor = useColorModeValue("#667085", "#A8B3C7");
  const total = chartSeries.reduce((sum, item) => sum + item, 0);

  const slices = useMemo(() => {
    let offset = 25;
    return chartSeries.map((value, index) => {
      const percent = total ? (value / total) * 100 : 0;
      const slice = { value, percent, color: colors[index % colors.length], offset };
      offset -= percent;
      return slice;
    });
  }, [chartSeries, total]);

  return (
    <Card>
      <Grid py={5} placeItems="center">
        <Box className="crm-donut-chart">
          <svg viewBox="0 0 120 120" className="crm-donut-chart__svg">
            <circle cx="60" cy="60" r="45" fill="none" stroke={trackColor} strokeWidth="18" />
            {slices.map((slice, index) => (
              <circle
                key={index}
                cx="60"
                cy="60"
                r="45"
                fill="none"
                stroke={slice.color}
                strokeWidth="18"
                strokeDasharray={`${slice.percent} ${100 - slice.percent}`}
                strokeDashoffset={slice.offset}
                pathLength="100"
                className="crm-donut-chart__slice"
              />
            ))}
            <text x="60" y="58" textAnchor="middle" fill={textColor} className="crm-donut-chart__value">
              {total}
            </text>
            <text x="60" y="74" textAnchor="middle" fill={mutedColor} className="crm-donut-chart__label">
              Total
            </text>
          </svg>
          <Flex className="crm-chart-legend" justify="center" wrap="wrap" gap="12px">
            {slices.map((slice, index) => (
              <Flex key={index} align="center" gap="7px">
                <Box className="crm-chart-legend__dot" bg={slice.color} />
                <Text fontSize="sm" fontWeight="700" color={mutedColor}>
                  {slice.value}
                </Text>
              </Flex>
            ))}
          </Flex>
        </Box>
      </Grid>
    </Card>
  );
};

export default DonutChart;
