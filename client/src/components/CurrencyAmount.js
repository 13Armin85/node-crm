import { Box, Text } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useLanguage } from 'i18n';
import { getApi } from 'services/api';

let cachedRate = null;
let rateRequest = null;
const loadRate = () => {
  if (cachedRate) return Promise.resolve(cachedRate);
  if (!rateRequest) rateRequest = getApi('api/estate/dashboard/exchange-rate').then(result => {
    if (result?.status !== 200) throw new Error('exchange-rate');
    cachedRate = result.data;
    return cachedRate;
  }).finally(() => { rateRequest = null; });
  return rateRequest;
};

const normalizeCurrency = value => value === '$' ? 'USD' : (value || 'TRY').toUpperCase();

export default function CurrencyAmount({ amount = 0, currency = 'TRY', compact = false, ...boxProps }) {
  const { language } = useLanguage();
  const normalized = normalizeCurrency(currency);
  const [rate, setRate] = useState(cachedRate);
  useEffect(() => {
    let active = true;
    loadRate().then(value => { if (active) setRate(value); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const locale = language === 'fa' ? 'fa-IR' : language === 'tr' ? 'tr-TR' : 'en-US';
  const number = Number(amount) || 0;
  const format = (value, code) => new Intl.NumberFormat(locale, {
    style: 'currency', currency: code, maximumFractionDigits: compact ? 0 : 2,
  }).format(value);
  const tryAmount = normalized === 'TRY'
    ? number
    : normalized === 'USD' && rate?.tryPerUsd
      ? number * rate.tryPerUsd
      : normalized === 'EUR' && rate?.tryPerEur
        ? number * rate.tryPerEur
        : null;
  const usdAmount = normalized === 'USD'
    ? number
    : tryAmount != null && rate?.usdPerTry
      ? tryAmount * rate.usdPerTry
      : null;
  const rateTitle = `TCMB ${rate?.sourceDate || ''} ${rate?.sourceHour || ''}`.trim();
  return <Box as={compact ? 'span' : 'div'} {...boxProps} data-no-translate>
    {normalized === 'EUR' && <Text as={compact ? 'span' : 'div'} me={compact ? 2 : 0}>{format(number, 'EUR')}</Text>}
    {tryAmount != null && <Text as={compact ? 'span' : 'div'} me={compact ? 2 : 0} title={rateTitle}>{format(tryAmount, 'TRY')}</Text>}
    {usdAmount != null && <Text as={compact ? 'span' : 'div'} fontSize={compact ? 'inherit' : 'xs'} color={compact ? 'inherit' : 'gray.500'} title={rateTitle}>{normalized === 'USD' ? '' : '≈ '}{format(usdAmount, 'USD')}</Text>}
    {tryAmount == null && usdAmount == null && <Text as="span">{format(number, normalized)}</Text>}
  </Box>;
}
