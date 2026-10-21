/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Exercises real controls through ReactDOM. */
import React from "react";
import ReactDOM from "react-dom";
import { act, Simulate } from "react-dom/test-utils";
import { ChakraProvider } from "@chakra-ui/react";
import AuditLogs from "./AuditLogs";
import { getApi } from "services/api";
import { exportSpreadsheet } from "utils/spreadsheet";
import { toast } from "react-toastify";
jest.mock("utils/spreadsheet", () => ({
  exportSpreadsheet: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn() } }));
jest.mock("services/api", () => ({ getApi: jest.fn() }));
jest.mock("i18n", () => ({
  useLanguage: () => ({
    language: "en",
    t: (value) =>
      jest.requireActual("i18n/auditLogs").default.en[value] || value,
  }),
}));
jest.setTimeout(30000);
let container;
const user = { _id: "000000000000000000000001", role: "admin" };
const otherId = "000000000000000000000002";
const event = {
  _id: "entry",
  actorId: user._id,
  actorName: "Test Person",
  actorUsername: "person@example.test",
  collection: "Properties",
  action: "update",
  operation: "update",
  recordCount: 1,
  recordLabel: "Seaside apartment",
  recordId: "internal-object-id",
  createdAt: "2026-10-20T12:00:00Z",
  changes: [
    {
      field: "customFields.technical",
      before: "Before secret",
      after: "After secret",
    },
  ],
};
const data = {
  items: [event],
  total: 26,
  summary: { create: 0, update: 26, delete: 0 },
  actors: [
    { _id: user._id, name: "Test Person" },
    { _id: otherId, name: "No History User" },
  ],
  collections: ["Properties"],
};
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("user", JSON.stringify(user));
  getApi.mockImplementation(async (path) => {
    const empty =
      new URLSearchParams(path.split("?")[1]).get("actorId") === otherId;
    return {
      status: 200,
      data: empty
        ? {
            ...data,
            items: [],
            total: 0,
            summary: { create: 0, update: 0, delete: 0 },
          }
        : data,
    };
  });
  container = document.createElement("div");
  document.body.appendChild(container);
});
afterEach(() => {
  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
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
    (node.textContent.startsWith(text) || (node.getAttribute("aria-label") || "").toLowerCase() === text.toLowerCase()),
  );
test("saved operations read as complete sentences with no raw field details or technical IDs", async () => {
  await render();
  expect(container.textContent).toContain(
    "Test Person edited and saved property",
  );
  expect(container.textContent).toContain("Seaside apartment");
  for (const internal of [
    "customFields.technical",
    "Before secret",
    "After secret",
    "internal-object-id",
  ])
    expect(container.textContent).not.toContain(internal);
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  await act(async () =>
    Simulate.change(container.querySelector("#audit-search"), {
      target: { value: "Seaside" },
    }),
  );
  await act(async () => Simulate.submit(container.querySelector("form")));
  expect(getApi.mock.calls.at(-1)[0]).toContain("q=Seaside");
  expect(getApi.mock.calls.at(-1)[2]).toEqual({ dataScope: false });
  await act(async () => Simulate.click(button("Next page")));
  expect(getApi.mock.calls.at(-1)[0]).toContain("page=2");
});
test("selecting any user applies immediately and shows their empty history without losing the full directory", async () => {
  await render();
  expect(container.querySelector("#audit-actor").textContent).toContain(
    "No History User",
  );
  await act(async () =>
    Simulate.change(container.querySelector("#audit-actor"), {
      target: { value: otherId },
    }),
  );
  expect(getApi.mock.calls.at(-1)[0]).toContain("actorId=" + otherId);
  expect(getApi.mock.calls.at(-1)[0]).toContain("page=1");
  expect(
    container.querySelector(".crm-audit-user-scope-title").textContent,
  ).toContain("No History User");
  expect(
    container.querySelector(".crm-audit-results").textContent,
  ).not.toContain("Test Person");
  await act(async () => Simulate.click(button("Clear filters")));
  expect(container.querySelector("#audit-actor").value).toBe(otherId);
});
test("per-user link opens with the selected history and ordinary users cannot select another person", async () => {
  window.history.replaceState({}, "", "/audit-logs?actorId=" + otherId);
  await render();
  expect(getApi.mock.calls.at(-1)[0]).toContain("actorId=" + otherId);
});
test("ordinary users only have personal activity and no user directory", async () => {
  localStorage.setItem("user", JSON.stringify({ ...user, role: "user" }));
  window.history.replaceState({}, "", "/audit-logs?actorId=" + otherId);
  await render();
  expect(container.querySelector("#audit-actor")).toBeNull();
  expect(getApi.mock.calls.at(-1)[0]).not.toContain("actorId=");
});
test("a missing route and a rejected network request both stop loading and allow retry", async () => {
  getApi.mockResolvedValueOnce({
    status: 404,
    data: "<html>Missing route</html>",
  });
  await render();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  getApi.mockRejectedValueOnce(new Error("Network failure"));
  await act(async () => Simulate.click(button("Retry")));
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.querySelector('[role="status"]')).toBeNull();
  await act(async () => Simulate.click(button("Retry")));
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

test("Excel includes every matching page, readable columns and applied filters rather than unsaved edits", async () => {
  const rows = Array.from({ length: 205 }, (_, index) => ({
    ...event,
    _id: "entry-" + index,
  }));
  getApi.mockImplementation(async (path) => {
    const query = new URLSearchParams(path.split("?")[1]);
    const limit = Number(query.get("limit"));
    const start = (Number(query.get("page")) - 1) * limit;
    return {
      status: 200,
      data: {
        ...data,
        total: rows.length,
        items: rows.slice(start, start + limit),
      },
    };
  });
  await render();
  for (const [selector, value] of [
    ["#audit-actor", user._id],
    ["#audit-search", "Seaside"],
    ["#audit-action", "update"],
    ["#audit-collection", "Properties"],
    ["#audit-from", "2026-10-01"],
    ["#audit-to", "2026-10-20"],
  ])
    await act(async () =>
      Simulate.change(container.querySelector(selector), { target: { value } }),
    );
  await act(async () => Simulate.submit(container.querySelector("form")));
  await act(async () => Simulate.click(button("Next page")));
  const applied = new URLSearchParams(
    getApi.mock.calls.at(-1)[0].split("?")[1],
  );
  await act(async () =>
    Simulate.change(container.querySelector("#audit-search"), {
      target: { value: "Unsaved search" },
    }),
  );
  const before = getApi.mock.calls.length;
  await act(async () => Simulate.click(button("Export as Excel")));
  const calls = getApi.mock.calls.slice(before);
  expect(calls).toHaveLength(3);
  calls.forEach(([path, unused, config], index) => {
    const query = new URLSearchParams(path.split("?")[1]);
    expect(query.get("page")).toBe(String(index + 1));
    expect(query.get("limit")).toBe("100");
    for (const key of ["actorId", "q", "action", "collection", "from", "to"])
      expect(query.get(key)).toBe(applied.get(key));
    expect(config).toEqual({ dataScope: false });
  });
  const exported = exportSpreadsheet.mock.calls[0][0];
  expect(exported.jsonArray).toHaveLength(205);
  expect(exported.extension).toBe("xlsx");
  expect(exported.fileName).toMatch(/^audit-logs-\d{4}-\d{2}-\d{2}$/);
  expect(exported.csvColumns.map((column) => column.Header)).toEqual([
    "Date and time",
    "Performed by",
    "Username",
    "Section",
    "Activity",
    "What happened",
  ]);
  const cells = exported.csvColumns.map((column) =>
    typeof column.accessor === "function"
      ? column.accessor(event)
      : event[column.accessor],
  );
  expect(cells.join(" ")).toContain("Test Person edited and saved property");
  expect(cells.join(" ")).not.toMatch(
    /internal-object-id|Before secret|After secret|customFields/,
  );
});
test("ordinary exports omit actor overrides and failed later pages do not download a partial workbook", async () => {
  localStorage.setItem("user", JSON.stringify({ ...user, role: "user" }));
  window.history.replaceState({}, "", "/audit-logs?actorId=" + otherId);
  getApi.mockImplementation(async (path) => {
    const query = new URLSearchParams(path.split("?")[1]);
    if (query.get("limit") === "100" && query.get("page") === "2")
      return { status: 500, data: {} };
    return {
      status: 200,
      data: {
        ...data,
        total: 101,
        items: Array.from(
          { length: query.get("limit") === "100" ? 100 : 25 },
          (_, index) => ({ ...event, _id: "own-" + index }),
        ),
      },
    };
  });
  await render();
  await act(async () => Simulate.click(button("Export as Excel")));
  const calls = getApi.mock.calls.filter(([path]) =>
    path.includes("limit=100"),
  );
  expect(calls).toHaveLength(2);
  expect(
    calls.every(
      ([path, unused, config]) =>
        !path.includes("actorId") && config.dataScope === false,
    ),
  ).toBe(true);
  expect(exportSpreadsheet).not.toHaveBeenCalled();
  expect(toast.error).toHaveBeenCalledWith("Failed to export data");
  expect(button("Export as Excel").disabled).toBe(false);
});
