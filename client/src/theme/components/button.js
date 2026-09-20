import { mode } from "@chakra-ui/theme-tools";
export const buttonStyles = {
  components: {
    Button: {
      baseStyle: {
        borderRadius: "12px",
        boxShadow: "none",
        transition: ".25s all ease",
        boxSizing: "border-box",
        fontWeight: "700",
        _focus: {
          boxShadow: "none",
        },
        _active: {
          boxShadow: "none",
        },
      },
      variants: {
        outline: () => ({
          borderRadius: "16px",
        }),
        brand: (props) => ({
          bg: mode("linear-gradient(135deg, #3563E9, #4F7AF2)", "linear-gradient(135deg, #4F7AF2, #6E92F8)")(props),
          color: "white",
          boxShadow: mode(
            "0 10px 24px rgba(23, 125, 220, 0.25)",
            "0 10px 28px rgba(62, 155, 239, 0.24)",
          )(props),
          _focus: {
            bg: mode("linear-gradient(135deg, #3563E9, #4F7AF2)", "linear-gradient(135deg, #4F7AF2, #6E92F8)")(props),
          },
          _active: {
            bg: mode("linear-gradient(135deg, #264CC7, #3563E9)", "linear-gradient(135deg, #416CDE, #5B86F7)")(props),
          },
          _hover: {
            bg: mode("linear-gradient(135deg, #264CC7, #3563E9)", "linear-gradient(135deg, #416CDE, #5B86F7)")(props),
            transform: "translateY(-1px)",
            boxShadow: mode(
              "0 16px 32px rgba(23, 125, 220, 0.30)",
              "0 16px 34px rgba(62, 155, 239, 0.30)",
            )(props),
          },
        }),
        darkBrand: (props) => ({
          bg: mode("brand.900", "brand.400")(props),
          color: "white",
          _focus: {
            bg: mode("brand.900", "brand.400")(props),
          },
          _active: {
            bg: mode("brand.900", "brand.400")(props),
          },
          _hover: {
            bg: mode("brand.800", "brand.400")(props),
          },
        }),
        lightBrand: (props) => ({
          bg: mode("#F2EFFF", "whiteAlpha.100")(props),
          color: mode("brand.500", "white")(props),
          _focus: {
            bg: mode("#F2EFFF", "whiteAlpha.100")(props),
          },
          _active: {
            bg: mode("secondaryGray.300", "whiteAlpha.100")(props),
          },
          _hover: {
            bg: mode("secondaryGray.400", "whiteAlpha.200")(props),
          },
        }),
        light: (props) => ({
          bg: mode("white", "whiteAlpha.100")(props),
          color: mode("secondaryGray.900", "white")(props),
          border: "1px solid",
          borderColor: mode("blackAlpha.100", "whiteAlpha.200")(props),
          _focus: {
            bg: mode("secondaryGray.300", "whiteAlpha.100")(props),
          },
          _active: {
            bg: mode("secondaryGray.300", "whiteAlpha.100")(props),
          },
          _hover: {
            bg: mode("brand.50", "whiteAlpha.200")(props),
            transform: "translateY(-1px)",
          },
        }),
        action: (props) => ({
          fontWeight: "500",
          borderRadius: "50px",
          bg: mode("secondaryGray.300", "brand.400")(props),
          color: mode("brand.500", "white")(props),
          _focus: {
            bg: mode("secondaryGray.300", "brand.400")(props),
          },
          _active: { bg: mode("secondaryGray.300", "brand.400")(props) },
          _hover: {
            bg: mode("secondaryGray.200", "brand.400")(props),
          },
        }),
        setup: (props) => ({
          fontWeight: "500",
          borderRadius: "50px",
          bg: mode("transparent", "brand.400")(props),
          border: mode("1px solid", "0px solid")(props),
          borderColor: mode("secondaryGray.400", "transparent")(props),
          color: mode("secondaryGray.900", "white")(props),
          _focus: {
            bg: mode("transparent", "brand.400")(props),
          },
          _active: { bg: mode("transparent", "brand.400")(props) },
          _hover: {
            bg: mode("secondaryGray.100", "brand.400")(props),
          },
        }),
      },
    },
  },
};
