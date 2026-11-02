import type { Metadata } from "next";
import { TaskBoardView } from "@/components/tasks/task-board-view";

export const metadata: Metadata = { title: "All tasks" };

export default function TasksPage() {
  return <TaskBoardView />;
}
