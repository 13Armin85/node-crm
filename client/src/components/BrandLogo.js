import { Image } from '@chakra-ui/react';

export const brandLogo = (process.env.PUBLIC_URL || '') + '/brand-logo.png';

export default function BrandLogo(props) {
  return <Image src={brandLogo} fallbackSrc={brandLogo} alt="آراد" objectFit="contain" {...props} />;
}
