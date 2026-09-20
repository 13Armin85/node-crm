import { Flex, Text } from "@chakra-ui/react";
import { useLanguage } from "i18n";

export default function Footer() {
  const { t } = useLanguage();
  return (
    <Flex className="crm-footer" align="center" justify="space-between" wrap="wrap" gap="8px">
      <Text>© {new Date().getFullYear()} {t("All rights reserved for Amard Company.")}</Text>
      <Text className="crm-footer__product">{t("CRM Studio")} · {t("Business workspace")}</Text>
    </Flex>
  );
}
