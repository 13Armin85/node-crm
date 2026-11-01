import { Box, useStyleConfig } from "@chakra-ui/react";
function Card(props) {
  const { variant, children, className = '', ...rest } = props;
  const styles = useStyleConfig("Card", { variant });

  return (
    <Box __css={styles} height={"100%"} {...rest} className={`crm-card ${className}`.trim()}>
      {children}
    </Box>
  );
}
export default Card;
