import { createBreakpoints } from "@chakra-ui/theme-tools";

export const breakpoints = createBreakpoints({
  base: "0em",
  // Keep phone forms and kanban cards readable before enabling two columns.
  sm: "480px",
  md: "768px",
  lg: "960px",
  xl: "1200px",
  "2xl": "1600px",
  "2sm": "380px",
  "3xl": "1920px",
});

// export default breakpoints
