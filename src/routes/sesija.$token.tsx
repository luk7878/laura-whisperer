import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sesija/$token")({
  component: SessionLayout,
});

function SessionLayout() {
  return <Outlet />;
}