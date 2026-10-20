import FieldMissionsView from "@/components/FieldMissionsView";

export const metadata = {
  title: "Missions Terrain & Dispatch Telegram | GoCab CRM",
  description: "Vue mobile et WebApp Telegram pour les superviseurs et agents terrain GoCab.",
};

export default function FieldMissionsPage() {
  return <FieldMissionsView standalone={true} />;
}
