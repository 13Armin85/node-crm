import { mode } from "@chakra-ui/theme-tools";
export const globalStyles = {
  colors: {
    brand: {
      50: "#EEF7FF",
      100: "#D8ECFF",
      200: "#A8D6FF",
      300: "#71BAF8",
      400: "#3E9BEF",
      500: "#177DDC",
      600: "#0F66B8",
      700: "#11508C",
      800: "#103C68",
      900: "#0A2748",
    },
    brandScheme: {
      100: "#D8ECFF",
      200: "#A8D6FF",
      300: "#71BAF8",
      400: "#3E9BEF",
      500: "#177DDC",
      600: "#0F66B8",
      700: "#11508C",
      800: "#103C68",
      900: "#0A2748",
    },
    brandTabs: {
      100: "#D8ECFF",
      200: "#A8D6FF",
      300: "#71BAF8",
      400: "#3E9BEF",
      500: "#177DDC",
      600: "#0F66B8",
      700: "#11508C",
      800: "#103C68",
      900: "#0A2748",
    },
    secondaryGray: {
      100: "#E0E5F2",
      200: "#E1E9F8",
      300: "#F4F7FE",
      400: "#E9EDF7",
      500: "#8F9BBA",
      600: "#A3AED0",
      700: "#707EAE",
      800: "#707EAE",
      900: "#1B2559",
    },
    red: {
      100: "#FEEFEE",
      300: "#eb7b74",
      500: "#EE5D50",
      600: "#E31A1A",
    },
    blue: {
      50: "#EFF4FB",
      500: "#3965FF",
    },
    orange: {
      100: "#FFF6DA",
      400: "#fde04ce8",
      500: "#FFB547",
    },
    green: {
      100: "#E6FAF5",
      500: "#01B574",
    },
    navy: {
      50: "#d0dcfb",
      100: "#aac0fe",
      200: "#a3b9f8",
      300: "#728fea",
      400: "#3652ba",
      500: "#1b3bbb",
      600: "#24388a",
      700: "#1B254B",
      800: "#111c44",
      900: "#0b1437",
    },
    gray: {
      100: "#FAFCFE",
      200: "#E2E8F0",
      300: "#CBD5E0",
      400: "#A0AEC0",
      500: "#718096",
      600: "#4A5568",
      700: "#2D3748",
      800: "#1A202C",
      900: "#171923",
    },
  },
  styles: {
    global: (props) => ({
      body: {
        overflowX: "hidden",
        bg: mode("#F5F7FB", "#07111F")(props),
        color: mode("gray.700", "whiteAlpha.900")(props),
        fontFamily:
          'Inter, "Plus Jakarta Sans", "Vazirmatn", "Segoe UI", sans-serif',
        letterSpacing: "0",
        backgroundImage: mode(
          "linear-gradient(135deg, rgba(23, 125, 220, 0.08), transparent 34%), linear-gradient(rgba(15, 102, 184, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 102, 184, 0.035) 1px, transparent 1px)",
          "linear-gradient(135deg, rgba(122, 183, 255, 0.09), transparent 34%), linear-gradient(225deg, rgba(56, 223, 183, 0.08), transparent 36%), linear-gradient(rgba(157, 178, 210, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(157, 178, 210, 0.035) 1px, transparent 1px)",
        )(props),
        backgroundSize: mode("auto, 48px 48px, 48px 48px", "auto, auto, 52px 52px, 52px 52px")(props),
      },
      input: {
        color: mode("gray.700", "whiteAlpha.900")(props),
      },
      html: {
        fontFamily:
          'Inter, "Plus Jakarta Sans", "Vazirmatn", "Segoe UI", sans-serif',
      },
      "html[dir='rtl'] body": {
        fontFamily:
          '"Vazirmatn", "IRANSans", Inter, "Segoe UI", sans-serif',
      },
      "*": {
        scrollbarWidth: "thin",
        scrollbarColor: mode(
          "rgba(17, 80, 140, 0.25) transparent",
          "rgba(255,255,255,0.16) transparent",
        )(props),
      },
      "*::selection": {
        bg: mode("brand.100", "brand.700")(props),
      },
    }),
  },
};
