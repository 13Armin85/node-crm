import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
// All languages share the same physical layout; Persian text still shapes naturally.
const cache = createCache({ key: 'css-en' });
export function RtlProvider({ children }) {
  return <CacheProvider value={cache} children={children} />;
}
