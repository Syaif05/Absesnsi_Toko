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
import { OwnerPanel } from "../../src/components/owner-panel";
import { AuthService } from "../../src/server/auth/service";
import { OwnerService } from "../../src/server/owner/service";
import { createOwnerHandler } from "../../src/server/owner/http";
import { createAuthHandler, cookieName } from "../../src/server/auth/http";
import type { AuthDatabase } from "../../src/server/auth/types";
const pg = new PGlite({ extensions: { btree_gist } });
const db: AuthDatabase = {
  transaction: (work) =>
    pg.transaction((tx) =>
      work({ query: (text, values) => tx.query(text, values) }),
    ),
};
const auth = new AuthService(
  db,
  "e0000000-0000-4000-8000-000000000001",
  "ui-test-secret-".repeat(4),
);
const owner = new OwnerService(auth),
  ownerHandler = createOwnerHandler(() => ({
    owner,
    origin: "http://localhost:3000",
  })),
  authHandler = createAuthHandler(() => ({
    service: auth,
    origin: "http://localhost:3000",
  }));
let token = "";
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
    fullName: "Owner Tes",
    businessName: "Usaha Tes",
  });
  token = (await auth.login("owner", "owner", "ui-owner-password-test")).token;
  for (const [code, name] of [
    ["PST", "Pusat"],
    ["TMR", "Timur"],
  ])
    await owner.createStore(token, {
      name,
      code,
      address: "Alamat contoh",
      lat: -6.2,
      lng: 106.8,
    });
  vi.stubGlobal("fetch", async (path: string, options: RequestInit = {}) => {
    const url = new URL(path, "http://localhost:3000");
    const request = new NextRequest(url, {
      method: options.method ?? "GET",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
        cookie: cookieName + "=" + token,
      },
      body: options.body,
    });
    const segments = url.pathname.split("/").filter(Boolean);
    const resource = segments[2];
    return segments[4] === "reset-pin"
      ? authHandler(request, "reset-pin", segments[3])
      : ownerHandler(
          request,
          resource as "stores" | "employees" | "settings",
          segments[3],
        );
  });
}, 30000);
afterEach(cleanup);
afterAll(async () => {
  vi.unstubAllGlobals();
  await pg.close();
});
async function renderOwner() {
  render(<OwnerPanel fullName="Owner Tes" />);
  await screen.findByRole("heading", { name: "Pusat" });
}
it("store form persists third store through real API and database", async () => {
  const user = userEvent.setup();
  await renderOwner();
  await user.click(screen.getByRole("button", { name: "Tambah toko" }));
  const dialog = screen.getByRole("dialog", { name: "Tambah toko" });
  for (const [label, value] of [
    ["Nama toko", "Barat"],
    ["Kode unik toko", "BRT"],
    ["Alamat", "Alamat Barat"],
    ["Latitude", "-6.2"],
    ["Longitude", "106.8"],
  ])
    await user.type(
      within(dialog).getByLabelText(label, { exact: true }),
      value,
    );
  await user.click(within(dialog).getByRole("button", { name: "Simpan" }));
  await screen.findByRole("heading", { name: "Barat" });
  expect((await owner.listStores(token)).items).toHaveLength(3);
  cleanup();
  await renderOwner();
  expect(await screen.findByRole("heading", { name: "Barat" })).toBeTruthy();
});
it("employee creation shows PIN once and ID edits require explicit confirmation", async () => {
  const user = userEvent.setup();
  await renderOwner();
  await user.click(screen.getByRole("button", { name: "Karyawan" }));
  await screen.findByRole("heading", { name: "Belum ada karyawan" });
  await user.click(screen.getByRole("button", { name: "Tambah karyawan" }));
  let dialog = screen.getByRole("dialog", { name: "Tambah karyawan" });
  await user.type(
    within(dialog).getByLabelText("Nama lengkap", { exact: true }),
    "Contoh UI",
  );
  await user.type(
    within(dialog).getByLabelText("ID login (kosongkan untuk otomatis)", {
      exact: true,
    }),
    "UI-001",
  );
  await user.click(within(dialog).getByRole("button", { name: "Simpan" }));
  await screen.findByRole("heading", { name: "PIN sementara untuk UI-001" });
  await user.click(
    screen.getByRole("button", { name: "Sudah dicatat, sembunyikan" }),
  );
  expect(
    screen.queryByRole("heading", { name: "PIN sementara untuk UI-001" }),
  ).toBeNull();
  await user.click(screen.getByRole("button", { name: "Edit" }));
  dialog = screen.getByRole("dialog", { name: "Edit karyawan" });
  const code = within(dialog).getByLabelText(
    "ID login (kosongkan untuk otomatis)",
    { exact: true },
  );
  await user.clear(code);
  await user.type(code, "UI-009");
  await user.click(within(dialog).getByRole("button", { name: "Simpan" }));
  let confirm = screen.getByRole("dialog", { name: "Konfirmasi tindakan" });
  expect((await owner.listEmployees(token)).items[0].employee_code).toBe(
    "UI-001",
  );
  await user.click(within(confirm).getByRole("button", { name: "Batal" }));
  expect((await owner.listEmployees(token)).items[0].employee_code).toBe(
    "UI-001",
  );
  await user.click(within(dialog).getByRole("button", { name: "Simpan" }));
  confirm = screen.getByRole("dialog", { name: "Konfirmasi tindakan" });
  await user.click(
    within(confirm).getByRole("button", { name: "Ya, lanjutkan" }),
  );
  await screen.findByText("UI-009", { exact: true });
  expect((await owner.listEmployees(token)).items[0].employee_code).toBe(
    "UI-009",
  );
});
it("employee deactivate/reactivate and PIN reset work through confirmation", async () => {
  const user = userEvent.setup();
  await renderOwner();
  await user.click(screen.getByRole("button", { name: "Karyawan" }));
  await screen.findByRole("heading", { name: "Contoh UI" });
  await user.click(screen.getByRole("button", { name: "Nonaktifkan" }));
  await user.click(
    within(
      screen.getByRole("dialog", { name: "Konfirmasi tindakan" }),
    ).getByRole("button", { name: "Ya, lanjutkan" }),
  );
  await screen.findByRole("button", { name: "Aktifkan" });
  expect((await owner.listEmployees(token)).items[0].status).toBe("inactive");
  await user.click(screen.getByRole("button", { name: "Aktifkan" }));
  await user.click(
    within(
      screen.getByRole("dialog", { name: "Konfirmasi tindakan" }),
    ).getByRole("button", { name: "Ya, lanjutkan" }),
  );
  await screen.findByRole("button", { name: "Nonaktifkan" });
  await user.click(screen.getByRole("button", { name: "Reset PIN" }));
  await user.click(
    within(
      screen.getByRole("dialog", { name: "Konfirmasi tindakan" }),
    ).getByRole("button", { name: "Ya, lanjutkan" }),
  );
  await screen.findByRole("heading", { name: "PIN sementara untuk UI-009" });
});
it("settings save persists and invalid duplicate code stays in editor", async () => {
  const user = userEvent.setup();
  await renderOwner();
  await user.click(screen.getByRole("button", { name: "Pengaturan" }));
  const radius = await screen.findByLabelText("Radius default (meter)", {
    exact: true,
  });
  await user.clear(radius);
  await user.type(radius, "175");
  await user.click(screen.getByRole("button", { name: "Simpan pengaturan" }));
  await waitFor(async () =>
    expect((await owner.settings(token)).radiusM).toBe(175),
  );
  await user.click(screen.getByRole("button", { name: "Toko" }));
  await screen.findByRole("heading", { name: "Pusat" });
  await user.click(screen.getByRole("button", { name: "Tambah toko" }));
  const dialog = screen.getByRole("dialog", { name: "Tambah toko" });
  for (const [label, value] of [
    ["Nama toko", "Duplikat"],
    ["Kode unik toko", "PST"],
    ["Alamat", "Alamat"],
    ["Latitude", "-6.2"],
    ["Longitude", "106.8"],
  ])
    await user.type(
      within(dialog).getByLabelText(label, { exact: true }),
      value,
    );
  await user.click(within(dialog).getByRole("button", { name: "Simpan" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("dialog", { name: "Tambah toko" })).toBeTruthy();
  expect((await owner.listStores(token)).items).toHaveLength(3);
});
