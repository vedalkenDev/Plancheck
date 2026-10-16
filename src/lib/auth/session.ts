import { cache } from "react";
import { cookies } from "next/headers";
import { GATE_COOKIE, readGate } from "@/lib/auth/gate";

export type AllowedUser = {
  email: string;
};

export const getAllowedUser = cache(async (): Promise<AllowedUser | null> => {
  const jar = await cookies();
  const email = readGate(jar.get(GATE_COOKIE)?.value);
  if (!email) {
    return null;
  }
  return { email };
});
