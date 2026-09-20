import { mode } from "@chakra-ui/theme-tools";
const Card = {
  baseStyle: (props) => ({
    p: "20px",
    display: "flex",
    flexDirection: "column",
    width: "100%",
    position: "relative",
    borderRadius: "18px",
    minWidth: "0px",
    wordWrap: "break-word",
    bg: mode("rgba(255,255,255,0.94)", "rgba(17,24,39,0.92)")(props),
    border: "1px solid",
    borderColor: mode("rgba(15, 102, 184, 0.10)", "rgba(255,255,255,0.08)")(
      props,
    ),
    boxShadow: mode(
      "0 12px 35px rgba(25, 42, 75, 0.07)",
      "0 20px 55px rgba(0,0,0,0.32)",
    )(props),
    backdropFilter: "blur(16px)",
    backgroundClip: "border-box",
    transition: "transform .18s ease, box-shadow .18s ease, border-color .18s ease",
    _hover: {
      borderColor: mode("rgba(15, 102, 184, 0.22)", "rgba(113,186,248,0.22)")(
        props,
      ),
    },
  }),
};

export const CardComponent = {
  components: {
    Card,
  },
};
