import type { ReactNode } from "react";
import { LockedArea } from "@/components/admin/locked-area";

/** A locked area: the password again, closed after five idle minutes. */
export default function Layout({ children }: { children: ReactNode }) {
  return <LockedArea>{children}</LockedArea>;
}
