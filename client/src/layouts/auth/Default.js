// Chakra imports
import { Flex, useColorModeValue } from "@chakra-ui/react";

function AuthIllustration(props) {
  const { children } = props;
  // Chakra color mode
  const authBg = useColorModeValue(
    "#F5F7FB",
    "#07111F",
  );
  return (
    <Flex minH="100vh" bg={authBg} overflow="hidden" align="center" justify="center" px="20px">
      <Flex
        w="100%"
        maxW="460px"
        mx="auto"
        justifyContent="center"
        alignItems="center"
        direction="column"
      >
        {children}
      </Flex>
    </Flex>
  );
}

export default AuthIllustration;
