import { redirect } from "next/navigation";

export default function FlaggedDriversPage() {
  redirect("/?tab=flagged-drivers");
}
