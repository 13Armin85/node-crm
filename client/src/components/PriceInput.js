import { Input } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { formatPriceInput, normalizePriceInput } from 'utils/price';

export default function PriceInput({ value, onValueChange, ...props }) {
  const [draft, setDraft] = useState(() => formatPriceInput(value));
  const lastValue = useRef(value);
  const input = useRef(null);
  useEffect(() => {
    if (value !== lastValue.current) setDraft(formatPriceInput(value));
    lastValue.current = value;
  }, [value]);
  const change = event => {
    const raw = normalizePriceInput(event.target.value);
    if (!/^\d*(\.\d*)?$/.test(raw)) return;
    const beforeCursor = normalizePriceInput(event.target.value.slice(0, event.target.selectionStart)).length;
    const formatted = formatPriceInput(raw);
    setDraft(formatted);
    const next = raw === '' || raw === '.' ? '' : Number(raw);
    lastValue.current = next;
    onValueChange(next);
    // Keep the caret next to the edited digit as grouping separators appear.
    requestAnimationFrame(() => {
      if (!input.current || document.activeElement !== input.current) return;
      let position = 0;
      let digits = 0;
      while (position < formatted.length && digits < beforeCursor) {
        if (formatted[position] !== ',') digits += 1;
        position += 1;
      }
      input.current.setSelectionRange(position, position);
    });
  };
  return <Input {...props} ref={input} type="text" inputMode="decimal" dir="ltr" value={draft} onChange={change} />;
}
