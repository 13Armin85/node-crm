/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Exercises the actual controls through ReactDOM. */
import React from "react";
import ReactDOM from "react-dom";
import { act, Simulate } from "react-dom/test-utils";
import { ChakraProvider } from "@chakra-ui/react";
import AuditLogs from "./AuditLogs";
import { getApi } from "services/api";
jest.mock("services/api", () => ({ getApi: jest.fn() }));
jest.mock("i18n", () => ({
  useLanguage: () => ({ language: "en", t: (value) => value }),
}));
jest.setTimeout(30000);
let container;
const user = { _id: "000000000000000000000001", role: "admin" };
const event = {
  _id: "entry",
  actorId: user._id,
  actorName: "Test Person",
  actorUsername: "person@example.test",
  collection: "User",
  action: "update",
  recordId: user._id,
  createdAt: "2026-10-20T12:00:00Z",
  changes: [
    { field: "firstName", before: "Old Name", after: "New Name" },
    { field: "password", before: "[REDACTED]", after: "[REDACTED]" },
  ],
};
const response = {
  status: 200,
  data: {
    items: [event],
    total: 26,
    summary: { create: 0, update: 26, delete: 0 },
    actors: [{ _id: user._id, name: "Test Person" }],
    collections: ["User"],
  },
};
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("user", JSON.stringify(user));
  getApi.mockResolvedValue(response);
  container = document.createElement("div");
  document.body.appendChild(container);
});
afterEach(() => {
  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
  localStorage.clear();
});
const render = async () =>
  act(async () => {
    ReactDOM.render(
      <ChakraProvider>
        <AuditLogs />
      </ChakraProvider>,
      container,
    );
  });
const button = (text) =>
  [...container.querySelectorAll("button")].find((node) =>
    node.textContent.startsWith(text),
  );
test("admin sees actor filtering, applies filters, pages results and inspects old and new values", async () => {
  await render();
  expect(container.querySelector("#audit-actor")).not.toBeNull();
  expect(container.textContent).toContain("Test Person");
  await act(async () =>
    Simulate.change(container.querySelector("#audit-search"), {
      target: { value: "firstName" },
    }),
  );
  await act(async () => Simulate.submit(container.querySelector("form")));
  expect(getApi.mock.calls.at(-1)[0]).toContain("q=firstName");
  expect(getApi.mock.calls.at(-1)[2]).toEqual({ dataScope: false });
  await act(async () => Simulate.click(button("audit.next")));
  expect(getApi.mock.calls.at(-1)[0]).toContain("page=2");
  await act(async () => Simulate.click(button("audit.details")));
  expect(document.body.textContent).toContain("Old Name");
  expect(document.body.textContent).toContain("New Name");
  expect(document.body.textContent).toContain("audit.redacted");
  expect(document.body.textContent).not.toContain("[REDACTED]");
});
test("ordinary user has own-activity help and no user filter", async () => {
  localStorage.setItem("user", JSON.stringify({ ...user, role: "user" }));
  await render();
  expect(container.querySelector("#audit-actor")).toBeNull();
  expect(container.textContent).toContain("audit.ownHint");
});
test("failed load shows retry and a successful empty result shows no activity", async () => {
  getApi.mockResolvedValueOnce({ status: 500 });
  await render();
  expect(container.textContent).toContain("audit.error");
  getApi.mockResolvedValueOnce({
    status: 200,
    data: { items: [], total: 0, actors: [], collections: [] },
  });
  await act(async () => Simulate.click(button("Retry")));
  expect(container.textContent).toContain("audit.empty");
});

test("a missing backend route shows retry and recovers when the service is available", async () => {
  getApi.mockResolvedValueOnce({
    status: 404,
    data: "<html>Cannot GET /api/audit-logs</html>",
  });
  await render();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.querySelectorAll(".crm-audit-stat")).toHaveLength(4);
  getApi.mockResolvedValueOnce(response);
  await act(async () => Simulate.click(button("Retry")));
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.querySelector(".crm-audit-results-count").textContent).toBe(
    "26",
  );
});
test("a network rejection ends the loading state and offers retry", async () => {
  getApi.mockRejectedValueOnce(new Error("Network failure"));
  await render();
  expect(container.querySelector('[role="status"]')).toBeNull();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
});
