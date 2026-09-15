import React, { useRef } from "react";
import {
  Input,
  InputGroup,
  InputRightElement,
} from "@chakra-ui/react";
import { CalendarIcon } from "@chakra-ui/icons";

// Keep date entry consistent: users choose from the browser calendar instead of
// typing a locale-dependent date by hand.
export default function CalendarDateInput({ type = "date", ...props }) {
  const inputRef = useRef(null);

  const openCalendar = () => {
    const input = inputRef.current;
    if (input && typeof input.showPicker === "function") {
      try {
        input.showPicker();
      } catch (_) {
        // Browsers without programmatic picker support still open their native
        // calendar through the input's built-in date control.
      }
    }
  };

  const preventManualEntry = (event) => {
    const navigationKeys = [
      "Tab",
      "Escape",
      "Enter",
      " ",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Backspace",
      "Delete",
    ];
    if (!navigationKeys.includes(event.key)) event.preventDefault();
  };

  return (
    <InputGroup>
      <Input
        {...props}
        ref={inputRef}
        type={type}
        className={["crm-calendar-input", props.className].filter(Boolean).join(" ")}
        inputMode="none"
        cursor="pointer"
        pe="42px"
        onClick={(event) => {
          props.onClick?.(event);
          openCalendar();
        }}
        onKeyDown={(event) => {
          props.onKeyDown?.(event);
          if (!event.defaultPrevented) preventManualEntry(event);
        }}
        onPaste={(event) => {
          props.onPaste?.(event);
          if (!event.defaultPrevented) event.preventDefault();
        }}
      />
      <InputRightElement pointerEvents="none" color="brand.500">
        <CalendarIcon />
      </InputRightElement>
    </InputGroup>
  );
}
