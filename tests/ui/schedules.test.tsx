// @vitest-environment jsdom
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, afterEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  within,
  waitFor,
  cleanup,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { NextRequest } from "next/server";
import { SchedulePanel } from "../../src/components/schedule-panel";
import { AuthService } from "../../src/server/auth/service";
import { OwnerService } from "../../src/server/owner/service";
import { ScheduleService } from "../../src/server/schedules/service";
import { createScheduleHandler } from "../../src/server/schedules/http";
import { createOwnerHandler } from "../../src/server/owner/http";
import { cookieName } from "../../src/server/auth/http";
import type { AuthDatabase } from "../../src/server/auth/types";
const pg = new PGlite({ extensions: { btree_gist } }),
  db: AuthDatabase = {
    transaction: (work) =>
      pg.transaction((tx) =>
        work({ query: (text, values) => tx.query(text, values) }),
      ),
  };
const auth = new AuthService(
    db,
    "e5000000-0000-4000-8000-000000000001",
    "ui-schedule-secret-".repeat(3),
  ),
  owner = new OwnerService(auth),
  schedules = new ScheduleService(auth);
const handler = createScheduleHandler(() => ({
    schedules,
    origin: "http://localhost:3000",
  })),
  ownerHandler = createOwnerHandler(() => ({
    owner,
    origin: "http://localhost:3000",
  }));
let token = "",
  employeeId = "",
  storeId = "",
  templateId = "";
beforeAll(async () => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  for (const file of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(readFileSync("drizzle/" + file, "utf8"));
  await auth.bootstrap({
    code: "owner",
    password: "ui-owner-password-test",
    fullName: "Owner UI",
    businessName: "Usaha UI",
  });
  token = (await auth.login("owner", "owner", "ui-owner-password-test")).token;
  storeId = (
    await owner.createStore(token, {
      name: "Toko UI",
      code: "UI",
      address: "Alamat contoh",
      lat: -6.2,
      lng: 106.8,
    })
  ).id;
  employeeId = (
    await owner.createEmployee(token, { fullName: "Karyawan UI", code: "UI-1" })
  ).employee.id;
  vi.stubGlobal("fetch", async (path: string, options: RequestInit = {}) => {
    const url = new URL(path, "http://localhost:3000"),
      r = new NextRequest(url, {
        method: options.method ?? "GET",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
          cookie: cookieName + "=" + token,
        },
        body: options.body,
      });
    const parts = url.pathname.split("/").filter(Boolean),
      resource = parts[2];
    return resource === "stores"
      ? ownerHandler(r, "stores")
      : handler(
          r,
          resource === "shift-templates"
            ? "templates"
            : resource === "schedule-people"
              ? "people"
              : "schedules",
          parts[3],
        );
  });
}, 30000);
afterEach(cleanup);
afterAll(async () => {
  vi.unstubAllGlobals();
  await pg.close();
});
async function start() {
  render(
    <SchedulePanel
      fullName="Owner UI"
      timezone="Asia/Jakarta"
      initialDate="2026-11-09"
    />,
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Tambah jadwal",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
}
async function draft(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Tambah jadwal" }));
  const dialog = screen.getByRole("dialog", { name: "Tambah jadwal" });
  await user.selectOptions(
    within(dialog).getByLabelText(/^Karyawan/),
    employeeId,
  );
  await user.selectOptions(
    within(dialog).getByLabelText(/^Toko penugasan/),
    storeId,
  );
  await user.selectOptions(
    within(dialog).getByLabelText(/^Template \(opsional\)/),
    templateId,
  );
  await user.click(within(dialog).getByRole("button", { name: "Simpan" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Tambah jadwal" })).toBeNull(),
  );
  await screen.findAllByRole("button", { name: "Terbitkan" });
}
it("UI creates overnight template and draft, then publishes after confirmation", async () => {
  const user = userEvent.setup();
  await start();
  await user.click(screen.getByRole("button", { name: "Template shift" }));
  await user.click(screen.getByRole("button", { name: "Tambah template" }));
  const dialog = screen.getByRole("dialog", { name: "Tambah template shift" });
  await user.type(within(dialog).getByLabelText("Nama template"), "Malam UI");
  await user.clear(within(dialog).getByLabelText("Jam mulai"));
  await user.type(within(dialog).getByLabelText("Jam mulai"), "20:00");
  await user.clear(within(dialog).getByLabelText("Jam selesai"));
  await user.type(within(dialog).getByLabelText("Jam selesai"), "05:00");
  await user.click(within(dialog).getByRole("checkbox"));
  await user.click(within(dialog).getByRole("button", { name: "Simpan" }));
  await screen.findByRole("heading", { name: "Malam UI" });
  templateId = (await schedules.templates(token)).items[0].id;
  await user.click(screen.getByRole("button", { name: "Jadwal mingguan" }));
  await draft(user);
  await user.click(screen.getAllByRole("button", { name: "Terbitkan" })[0]);
  const confirm = screen.getByRole("dialog", { name: "Terbitkan jadwal?" });
  expect(
    (
      await schedules.list(token, {
        from: "2026-11-09",
        to: "2026-11-16",
        status: "published",
      })
    ).items,
  ).toHaveLength(0);
  await user.click(
    within(confirm).getByRole("button", { name: "Ya, lanjutkan" }),
  );
  await waitFor(async () =>
    expect(
      (
        await schedules.list(token, {
          from: "2026-11-09",
          to: "2026-11-16",
          status: "published",
        })
      ).items,
    ).toHaveLength(1),
  );
});
it("overlap shows an actionable error and never publishes the second draft", async () => {
  const user = userEvent.setup();
  await start();
  await draft(user);
  await user.click(screen.getAllByRole("button", { name: "Terbitkan" })[0]);
  await user.click(
    within(screen.getByRole("dialog", { name: "Terbitkan jadwal?" })).getByRole(
      "button",
      { name: "Ya, lanjutkan" },
    ),
  );
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("bertabrakan");
  expect(
    (
      await schedules.list(token, {
        from: "2026-11-09",
        to: "2026-11-16",
        status: "published",
      })
    ).items,
  ).toHaveLength(1);
});
it("editing an attended shift requires confirmation and retains original attendance", async () => {
  const user = userEvent.setup();
  const original = (
    await schedules.list(token, {
      from: "2026-11-09",
      to: "2026-11-16",
      status: "published",
    })
  ).items[0];
  await pg.query(
    "insert into attendance.attendance_sessions(employee_id,schedule_id,check_in_at) values($1,$2,$3)",
    [employeeId, original.id, original.starts_at],
  );
  await start();
  const card = Array.from(
    document.querySelectorAll("article.scheduled-card"),
  ).find((el) => el.querySelector(".schedule-status.published"))!;
  await user.click(
    within(card as HTMLElement).getByRole("button", { name: "Edit" }),
  );
  const dialog = screen.getByRole("dialog", { name: "Edit jadwal" }),
    confirmation = within(dialog).getByRole("checkbox", {
      name: /Saya memahami perubahan waktu/,
    });
  await user.clear(within(dialog).getByLabelText("Jam mulai"));
  await user.type(within(dialog).getByLabelText("Jam mulai"), "19:30");
  await user.click(within(dialog).getByRole("button", { name: "Simpan" }));
  expect(
    (
      await schedules.list(token, {
        from: "2026-11-09",
        to: "2026-11-16",
        status: "published",
      })
    ).items[0].version,
  ).toBe(original.version);
  await user.click(confirmation);
  await user.click(within(dialog).getByRole("button", { name: "Simpan" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Edit jadwal" })).toBeNull(),
  );
  const changed = (
    await schedules.list(token, {
      from: "2026-11-09",
      to: "2026-11-16",
      status: "published",
    })
  ).items[0];
  expect(changed.version).toBe(original.version + 1);
  const recorded = (
    await pg.query<{ check_in_at: string }>(
      "select check_in_at from attendance.attendance_sessions where schedule_id=$1",
      [original.id],
    )
  ).rows[0].check_in_at;
  expect(new Date(recorded).toISOString()).toBe(original.starts_at);
});
