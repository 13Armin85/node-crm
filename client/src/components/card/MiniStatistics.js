import { LocalizedText } from 'i18n/runtime';
// Chakra imports
// Chakra imports
import {
  Flex,
  Stat,
  StatLabel,
  StatNumber,
  useColorModeValue,
  Text,
} from "@chakra-ui/react";
// Custom components
import Card from "components/card/Card.js";
import CountUpComponent from "components/countUpComponent/countUpComponent";
// Custom icons
import React from "react";

export default function Default(props) {
  const { startContent, endContent, name, growth, value } = props;
  const textColor = useColorModeValue("secondaryGray.900", "white");
  const textColorSecondary = "secondaryGray.600";

  return (
    <Card cursor={"pointer"} py="15px" onClick={props?.onClick}>
      <Flex
        my="auto"
        h="100%"
        align={{ base: "center", xl: "start" }}
        justify={{ base: "center", xl: "center" }}
      >
        {startContent}

        <Stat my="auto" minW="0" ms={startContent ? "18px" : "0px"}>
          <StatLabel
            lineHeight="1.5"
            overflowWrap="anywhere"
            color={textColorSecondary}
            fontSize={{
              base: props.fontsize ? props.fontsize : "sm",
            }}
          >
            <LocalizedText text={name} />
          </StatLabel>
          <StatNumber
            color={textColor}
            fontSize={{
              base: "2xl",
            }}
          >
            {value != null && <CountUpComponent targetNumber={value} />}
            {/* {value} */}
          </StatNumber>
          {growth ? (
            <Flex align="center">
              <Text color="green.500" fontSize="xs" fontWeight="700" me="5px">
                {growth}
              </Text>
              <Text color="secondaryGray.600" fontSize="xs" fontWeight="400"><LocalizedText text="since last month" /></Text>
            </Flex>
          ) : null}
        </Stat>
        <Flex ms="auto" w="max-content">
          {endContent}
        </Flex>
      </Flex>
    </Card>
  );
}
