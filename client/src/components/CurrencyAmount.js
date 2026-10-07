import { Box, Text, Tooltip } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useLanguage } from "i18n";
import { getApi } from "services/api";

let cachedRate = null;
let rateRequest = null;

const loadRate = () => {
  if (cachedRate) return Promise.resolve(cachedRate);
  if (!rateRequest) {
    rateRequest = getApi("api/estate/dashboard/exchange-rate")
      .then((result) => {
        if (result?.status !== 200) throw new Error("exchange-rate");
        cachedRate = result.data;
        return cachedRate;
      })
      .finally(() => { rateRequest = null; });
  }
  return rateRequest;
};

const normalizeCurrency = (value) => value === "$" ? "USD" : (value || "TRY").toUpperCase();

const validRate = value => Number.isFinite(Number(value)) && Number(value) > 0;

// Convert each currency bucket before adding it. Never display a partial total.
export function currencyTotals(values, rate) {
  let tryTotal = 0;
  let usdTotal = 0;
  let canShowTry = true;
  let canShowUsd = true;
  for (const value of values) {
    const amount = Number(value.amount);
    const currency = normalizeCurrency(value.currency);
    if (!Number.isFinite(amount) || !['TRY', 'USD', 'EUR'].includes(currency)) return { tryAmount: null, usdAmount: null };
    const tryAmount = currency === 'TRY' ? amount
      : validRate(currency === 'USD' ? rate?.tryPerUsd : rate?.tryPerEur)
        ? amount * Number(currency === 'USD' ? rate.tryPerUsd : rate.tryPerEur) : null;
    const usdAmount = currency === 'USD' ? amount
      : tryAmount != null && validRate(rate?.tryPerUsd) ? tryAmount / Number(rate.tryPerUsd) : null;
    if (tryAmount == null) canShowTry = false;
    else tryTotal += tryAmount;
    if (usdAmount == null) canShowUsd = false;
    else usdTotal += usdAmount;
  }
  return {
    tryAmount: canShowTry ? tryTotal : null,
    usdAmount: canShowUsd && (values.length || validRate(rate?.tryPerUsd)) ? usdTotal : null,
  };
}

export default function CurrencyAmount({ amount = 0, currency = "TRY", values, compact = false, ...boxProps }) {
  const { language, t } = useLanguage();
  const normalized = normalizeCurrency(currency);
  const [rate, setRate] = useState(cachedRate);
  const [rateLoading, setRateLoading] = useState(!cachedRate);

  useEffect(() => {
    let active = true;
    loadRate().then((value) => { if (active) setRate(value); }).catch(() => {})
      .finally(() => { if (active) setRateLoading(false); });
    return () => { active = false; };
  }, []);

  const locale = language === "fa" ? "fa-IR" : language === "tr" ? "tr-TR" : "en-US";
  const number = Number(amount) || 0;
  const format = (value, code) => new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  let tryAmount = normalized === "TRY"
    ? number
    : normalized === "USD" && rate?.tryPerUsd
      ? number * Number(rate.tryPerUsd)
      : normalized === "EUR" && rate?.tryPerEur
        ? number * Number(rate.tryPerEur)
        : null;
  let usdAmount = normalized === "USD"
    ? number
    : tryAmount != null && rate?.tryPerUsd
      ? tryAmount / Number(rate.tryPerUsd)
      : null;
  if (values !== undefined) ({ tryAmount, usdAmount } = currencyTotals(values, rate));
  const exactRate = Number(rate?.tryPerUsd);
  const rateLabel = Number.isFinite(exactRate)
    ? `1 USD = ${exactRate.toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 6 })} TRY`
    : t("Exchange rate unavailable");
  const rateMeta = ["TCMB", rate?.sourceDate, rate?.sourceHour].filter(Boolean).join(" · ");

  if (values !== undefined && tryAmount == null && usdAmount == null) {
    return <Text as="span" role="status" {...boxProps}>{t(rateLoading ? 'estate.loading' : 'Exchange rate unavailable')}</Text>;
  }

  if (tryAmount == null && usdAmount == null) {
    return <Text as="span" data-no-translate {...boxProps}>{format(number, normalized)}</Text>;
  }

  return (
    <Tooltip label={`${rateLabel}${rateMeta ? ` · ${rateMeta}` : ""}`} hasArrow placement="top">
      <Box
        as="span"
        className={`crm-currency${compact ? " crm-currency--compact" : ""}`}
        {...boxProps}
        data-no-translate
      >
        {normalized === "EUR" && tryAmount == null && (
          <Text as="span" className="crm-currency__primary">{format(number, "EUR")}</Text>
        )}
        {tryAmount != null && (
          <Text as="span" className="crm-currency__primary">{format(tryAmount, "TRY")}</Text>
        )}
        {usdAmount != null && (
          <Text as="span" className="crm-currency__usd">
            <Box as="span" className="crm-currency__usd-label">USD</Box>
            {format(usdAmount, "USD")}
          </Text>
        )}
        {!compact && Number.isFinite(exactRate) && (
          <Text as="span" className="crm-currency__rate">{rateLabel}</Text>
        )}
      </Box>
    </Tooltip>
  );
}
