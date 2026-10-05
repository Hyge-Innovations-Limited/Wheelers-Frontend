"use client";

import { createContext, useContext } from "react";

export type AdminRole = "OWNER" | "STAFF";

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
 * download and the Team pages, staff do not. The server refuses staff the
 * same things, so this only decides what is shown.
 */
const AdminSessionContext = createContext<{ admin: AdminSessionUser | null; isOwner: boolean }>({ admin: null, isOwner: false });

export const AdminSessionProvider = AdminSessionContext.Provider;

export function useAdminSession() {
  return useContext(AdminSessionContext);
}
