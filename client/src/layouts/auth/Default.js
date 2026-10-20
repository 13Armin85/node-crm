import { Box, Flex, useColorModeValue } from "@chakra-ui/react";

export default function AuthIllustration({ children }) {
  const authBg = useColorModeValue("#F5F7FB", "#07111F");
  return <Flex className="crm-auth-viewport" bg={authBg}>
    <Box className="crm-auth-container">{children}</Box>
  </Flex>;
}
