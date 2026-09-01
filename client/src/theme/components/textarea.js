import { mode } from "@chakra-ui/theme-tools";
export const textareaStyles = {
  components: {
    Textarea: {
      baseStyle: {
        field: {
          fontWeight: 400,
          borderRadius: "8px",
        },
      },

      variants: {
        main: (props) => ({
          field: {
            bg: mode("rgba(255,255,255,0.86)", "rgba(13,24,42,0.72)")(props),
            border: "1px solid !important",
            color: mode("secondaryGray.900", "white")(props),
            borderColor: mode("blackAlpha.100", "whiteAlpha.200")(props),
            borderRadius: "12px",
            fontSize: "sm",
            p: "20px",
            _placeholder: { color: "secondaryGray.400" },
          },
        }),
        auth: (props) => ({
          field: {
            bg: mode("rgba(255,255,255,0.78)", "rgba(255,255,255,0.06)")(props),
            border: "1px solid",
            borderColor: mode("blackAlpha.200", "whiteAlpha.200")(props),
            borderRadius: "12px",
            _placeholder: { color: "secondaryGray.600" },
          },
        }),
        authSecondary: (props) => ({
          field: {
            bg: "white",
            border: "1px solid",

            borderColor: "secondaryGray.100",
            borderRadius: "16px",
            _placeholder: { color: "secondaryGray.600" },
          },
        }),
        search: (props) => ({
          field: {
            border: "none",
            py: "11px",
            borderRadius: "inherit",
            _placeholder: { color: "secondaryGray.600" },
          },
        }),
      },
    },
  },
};
