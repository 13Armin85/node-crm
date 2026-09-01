import {
  HStack,
  Icon,
  Select,
  Text,
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
      spacing={compact ? 1 : 2}
      bg={bg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="12px"
      px={compact ? 2 : 3}
      py="6px"
      minW={compact ? "88px" : "150px"}
      maxW={compact ? "96px" : "180px"}
      flexShrink={0}
      data-no-translate
    >
      {!compact && <Icon as={MdLanguage} color={color} />}
      {!compact && (
        <Text color={color} fontSize="xs" fontWeight="700">
          {t("Language")}
        </Text>
      )}
      <Select
        aria-label={t("Language")}
        size="sm"
        variant="unstyled"
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        color={color}
        fontWeight="700"
        w={compact ? "62px" : "88px"}
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
