"use client";

import { createContext, useContext } from "react";

export type AdminRole = "OWNER" | "STAFF" | "SUPPORT";

/** Where a support login lands, and the only pages it has: the inbox, Activity and the people and trip look-ups. */
export const SUPPORT_HOME = "/admin/dashboard/support";
export const SUPPORT_PAGES = ["/admin/dashboard/support", "/admin/dashboard/activity", "/admin/desk"];

export interface AdminSessionUser {
  id: string | null;
  username: string;
  name: string;
  role: AdminRole;
  /** The code in the hidden mark on every page, which traces a leaked screenshot back to this admin. */
  markCode: string | null;
}

/**
 * Who is signed in, for the pages that differ by role: owners see the Excel
 * download and the Team pages, staff do not; support sees only the support
 * desk, with masked numbers and no money. The server refuses each role the
 * same things, so this only decides what is shown.
 */
const AdminSessionContext = createContext<{ admin: AdminSessionUser | null; isOwner: boolean; isSupport: boolean }>({ admin: null, isOwner: false, isSupport: false });

export const AdminSessionProvider = AdminSessionContext.Provider;

export function useAdminSession() {
  return useContext(AdminSessionContext);
}
