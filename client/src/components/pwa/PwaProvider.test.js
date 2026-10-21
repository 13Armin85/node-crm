/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Exercises Chakra dialogs through ReactDOM. */
import React from "react";
import ReactDOM from "react-dom";
import { act, Simulate } from "react-dom/test-utils";
import { ChakraProvider } from "@chakra-ui/react";
import PwaProvider, { usePwa } from "./PwaProvider";
import { registerPwa } from "services/pwa";
jest.mock("services/pwa", () => ({ registerPwa: jest.fn(() => () => {}) }));
jest.mock("i18n", () => ({
  useLanguage: () => ({
    language: "en",
    t: (key) => jest.requireActual("i18n/pwa").default.en[key] || key,
  }),
}));
let container;
const originalAgent = navigator.userAgent;
const originalSecure = window.isSecureContext;
function Entry() {
  const pwa = usePwa();
  return pwa.installed ? (
    <span>Installed marker</span>
  ) : (
    <button id="open-install" onClick={pwa.openInstall}>
      Open installer
    </button>
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  registerPwa.mockImplementation(() => () => {});
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: true,
  });
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: originalAgent,
  });
  container = document.createElement("div");
  document.body.appendChild(container);
});
afterEach(() => {
  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: originalSecure,
  });
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: originalAgent,
  });
});
const render = async () =>
  act(async () =>
    ReactDOM.render(
      <ChakraProvider>
        <PwaProvider>
          <Entry />
        </PwaProvider>
      </ChakraProvider>,
      container,
    ),
  );
const click = async (selector) =>
  act(async () => Simulate.click(document.querySelector(selector)));
test("native install only starts after a click and installed apps hide the entry", async () => {
  await render();
  const offer = new Event("beforeinstallprompt", { cancelable: true });
  offer.prompt = jest.fn().mockResolvedValue(undefined);
  offer.userChoice = Promise.resolve({ outcome: "accepted" });
  await act(async () => window.dispatchEvent(offer));
  expect(offer.defaultPrevented).toBe(true);
  expect(offer.prompt).not.toHaveBeenCalled();
  await click("#open-install");
  const install = [
    ...document.querySelectorAll(".crm-pwa-install button"),
  ].find((button) => button.textContent === "Install");
  await act(async () => Simulate.click(install));
  expect(offer.prompt).toHaveBeenCalledTimes(1);
  await act(async () => window.dispatchEvent(new Event("appinstalled")));
  expect(container.textContent).toContain("Installed marker");
});
test("iPhone offers Safari and home screen instructions", async () => {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: "iPhone Safari",
  });
  await render();
  await click("#open-install");
  expect(document.querySelector(".crm-pwa-steps").textContent).toContain(
    "Safari",
  );
  expect(document.querySelector(".crm-pwa-steps").textContent).toContain(
    "Add to Home Screen",
  );
});
test("insecure addresses explain the HTTPS requirement", async () => {
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: false,
  });
  await render();
  await click("#open-install");
  expect(document.querySelector(".crm-pwa-install").textContent).toContain(
    "secure HTTPS address",
  );
});
test("waiting updates only activate after the user clicks", async () => {
  const waiting = { state: "installed", postMessage: jest.fn() };
  registerPwa.mockImplementationOnce((callback) => {
    callback(waiting);
    return () => {};
  });
  await render();
  expect(waiting.postMessage).not.toHaveBeenCalled();
  expect(document.querySelector(".crm-pwa-status").textContent).toContain(
    "Save your changes",
  );
  const update = [...document.querySelectorAll(".crm-pwa-status button")].find(
    (button) => button.textContent === "Reload and update",
  );
  await act(async () => Simulate.click(update));
  expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
});
