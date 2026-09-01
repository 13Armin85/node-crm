// Chakra imports
import { Box, Flex, Heading, Image, Text, useColorModeValue } from "@chakra-ui/react";

// Custom components
import { HSeparator } from "components/separator/Separator";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchImage } from "../../../redux/slices/imageSlice";
import { useLanguage } from "i18n";

export function SidebarBrand(props) {
  const { setOpenSidebar, openSidebar, from, largeLogo } = props;

  //   Chakra color mode
  let logoColor = useColorModeValue("navy.700", "white");
  const panelBg = useColorModeValue(
    "rgba(255,255,255,0.92)",
    "rgba(13,24,42,0.92)",
  );
  const borderColor = useColorModeValue("blackAlpha.100", "whiteAlpha.100");
  const muted = useColorModeValue("gray.500", "whiteAlpha.600");
  const { t } = useLanguage();

  return (
    <Flex
      align="center"
      direction="column"
      bg={panelBg}
      zIndex="2"
      px="16px"
      py="14px"
      borderBottom="1px solid"
      borderColor={borderColor}
      style={{
        position: "sticky",
        top: "0",
        left: "0",
      }}
    >
      <Flex align="center" w="100%" justify={openSidebar ? "flex-start" : "center"}>
        {largeLogo && (largeLogo[0]?.logoLgImg || largeLogo[0]?.logoSmImg) ? (
          <Image
            style={{ width: "100%", height: "52px" }}
            src={
              openSidebar === true
                ? largeLogo[0]?.logoLgImg
                : largeLogo[0]?.logoSmImg
            } // Set the source path of your image
            alt="Logo" // Set the alt text for accessibility
            cursor="pointer"
            onClick={() => !from && setOpenSidebar(!openSidebar)}
            userSelect="none"
            my={2}
          />
        ) : (
          <>
            <Flex
              h="42px"
              w="42px"
              minW="42px"
              align="center"
              justify="center"
              borderRadius="12px"
              bg="linear-gradient(135deg, #177DDC 0%, #10DDB0 100%)"
              color="white"
              fontWeight="900"
              cursor="pointer"
              onClick={() => !from && setOpenSidebar(!openSidebar)}
              userSelect="none"
            >
              Pr
            </Flex>
            {openSidebar && (
              <Box ms="12px">
                <Heading size="md" color={logoColor} lineHeight="1">
                  Prolink
                </Heading>
                <Text mt="4px" color={muted} fontSize="xs" fontWeight="700">
                  {t("Dashboard")}
                </Text>
              </Box>
            )}
          </>
        )}
      </Flex>
    </Flex>
  );
}

export default SidebarBrand;
