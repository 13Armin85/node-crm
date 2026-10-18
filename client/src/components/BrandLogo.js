import { Image } from '@chakra-ui/react';

export const brandLogo = (process.env.PUBLIC_URL || '') + '/brand-logo-ta.png';

export default function BrandLogo({ className = '', sx, ...props }) {
  return <Image objectFit="contain" borderRadius={0} {...props}
    className={`crm-brand-logo ${className}`.trim()}
    sx={{ aspectRatio: '1 / 1', ...sx }} bg="transparent" p={0} filter="none"
    src={brandLogo} fallbackSrc={brandLogo} alt="تحلیل‌گران آمارد نوین" />;
}
