import { redirect } from "next/navigation";
import { sampleDrawings } from "@/data";
import { PlancheckApp } from "@/components/PlancheckApp";
import { getAllowedUser } from "@/lib/auth/session";

export default async function PlancheckPage() {
  const user = await getAllowedUser();
  if (!user) {
    redirect("/login");
  }
  return <PlancheckApp samples={sampleDrawings} userEmail={user.email} />;
}
