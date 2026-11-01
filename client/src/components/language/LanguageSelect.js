import {
  HStack,
  Icon,
  Select,
  useColorMode,
  useColorModeValue,
  IconButton,
  Tooltip,
} from "@chakra-ui/react";
import { MdDarkMode, MdLanguage, MdLightMode } from "react-icons/md";
import { LANGUAGES, useLanguage } from "i18n";

export function LanguageSelect({ compact = false }) {
  const { language, setLanguage, t } = useLanguage();
  const bg = useColorModeValue("whiteAlpha.900", "whiteAlpha.100");
  const color = useColorModeValue("navy.700", "white");
  const borderColor = useColorModeValue("blackAlpha.100", "whiteAlpha.200");

  return (
    <HStack
      className="crm-language-select"
      spacing={2}
      bg={bg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="4px"
      px={3}
      py={0}
      h="40px"
      w={compact ? "156px" : "180px"}
      minW={compact ? "156px" : "150px"}
      maxW="100%"
      flexShrink={0}
      data-no-translate
    >
      <Icon as={MdLanguage} color={color} flexShrink={0} boxSize="18px" aria-hidden="true" />
      <Select
        aria-label={t("Language")}
        size="sm"
        variant="unstyled"
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        color={color}
        fontWeight="500"
        fontSize="14px"
        h="100%"
        w="100%"
        minW="0"
        iconSize="16px"
        cursor="pointer"
        data-no-translate
      >
        {Object.values(LANGUAGES).map((item) => (
          <option key={item.code} value={item.code}>
            {item.nativeLabel}
          </option>
        ))}
      </Select>
    </HStack>
  );
}

export function ThemeToggle() {
  const { colorMode, toggleColorMode } = useColorMode();
  const { t } = useLanguage();
  const bg = useColorModeValue("whiteAlpha.900", "whiteAlpha.100");
  const color = useColorModeValue("navy.700", "white");
  const borderColor = useColorModeValue("blackAlpha.100", "whiteAlpha.200");
  const label = colorMode === "dark" ? "Light mode" : "Dark mode";

  return (
    <Tooltip label={t(label)}>
      <IconButton
        aria-label={t(label)}
        icon={<Icon as={colorMode === "dark" ? MdLightMode : MdDarkMode} />}
        onClick={toggleColorMode}
        size="sm"
        borderRadius="12px"
        bg={bg}
        color={color}
        border="1px solid"
        borderColor={borderColor}
        _hover={{ transform: "translateY(-1px)", bg: "brand.500", color: "white" }}
      />
    </Tooltip>
  );
}
