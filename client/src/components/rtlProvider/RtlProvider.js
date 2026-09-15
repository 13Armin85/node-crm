import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";

const ltrCache = createCache({ key: 'css-ltr' });
export function RtlProvider({ children }) {
  return <CacheProvider value={ltrCache} children={children} />;
}
