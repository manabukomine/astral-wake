import { createFileRoute } from "@tanstack/react-router";
import { Shooter } from "@/components/Shooter";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Shooter />;
}
