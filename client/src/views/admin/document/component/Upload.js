import {
  Box,
  Flex,
  Icon,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
// Assets
import Dropzone from "components/Dropzone";
import { MdUpload } from "react-icons/md";
import { useLanguage } from "i18n";

export default function Upload(props) {
  const { count } = props;
  const { t } = useLanguage();
  const brandColor = useColorModeValue("brand.500", "white");
  return (
    <Dropzone
      w="100%"
      minH={{ base: "150px", md: "190px" }}
      borderRadius="16px"
      onFileSelect={props?.onFileSelect}
      content={<Flex direction="column" align="center" justify="center" py={6}>
        <Flex w="64px" h="64px" borderRadius="20px" bg="brand.50" align="center" justify="center" mb={3}><Icon as={MdUpload} w="34px" h="34px" color={brandColor} /></Flex>
        <Text fontSize={{ base: "md", md: "lg" }} textAlign="center" fontWeight="900" color={brandColor}>{t("Drop files here")}</Text>
        <Text fontSize="sm" textAlign="center" color="gray.500" mt={1}>{t("or click to choose files")}</Text>
        <Text fontSize="xs" textAlign="center" color="gray.400" mt={2}>{t("Images, PDF, Word, Excel, ZIP and video")}</Text>
        {count > 0 && <Box mt={3} px={3} py={1} bg="green.50" color="green.600" borderRadius="full" fontSize="sm" fontWeight="800">{count} {t("Files")} {t("selected")}</Box>}
      </Flex>}
    />
  );
}
