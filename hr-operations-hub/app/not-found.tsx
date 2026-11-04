import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="standalone" id="main">
      <EmptyState
        icon={<SearchX size={22} aria-hidden />}
        kicker="404"
        title="This page does not exist"
        links={[{ href: "/", label: "Back to Today", primary: true }]}
      >
        <p>The HR Operations Hub has five sections: Today, Calendar, Portfolio, People and Playbooks.</p>
      </EmptyState>
    </main>
  );
}
